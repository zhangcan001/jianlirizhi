const fs = require('fs');
const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[db] better-sqlite3 加载失败：', e);
  throw e;
}

const TEXT_COLUMNS = [
  'date',
  'weekday',
  'writer',
  'city',
  'weatherMorning',
  'weatherAfternoon',
  'temperature',
  'humidity',
  'windDirection',
  'windPower',
  'constructionStatus',
  'contractorPersonnel',
  'machinery',
  'inspectionWork',
  'materialAcceptance',
  'acceptanceWork',
  'standingWork',
  'meeting',
  'internalWork',
  'issuesAndActions',
  'otherMatters',
  'chiefEngineerComments',
  'specialistSupervisorComments',
];

const SEARCHABLE_COLUMNS = [
  'constructionStatus',
  'contractorPersonnel',
  'machinery',
  'inspectionWork',
  'materialAcceptance',
  'acceptanceWork',
  'standingWork',
  'meeting',
  'internalWork',
  'issuesAndActions',
  'otherMatters',
  'chiefEngineerComments',
  'specialistSupervisorComments',
  'writer',
  'city',
];

let db = null;

function open(dataDir) {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'diaries.sqlite');
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const otherCols = TEXT_COLUMNS
    .filter((c) => c !== 'date')
    .map((c) => `"${c}" TEXT NOT NULL DEFAULT ''`)
    .join(', ');
  db.exec(`
    CREATE TABLE IF NOT EXISTS diaries (
      date TEXT PRIMARY KEY,
      ${otherCols},
      updatedAt TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_diaries_updated ON diaries(updatedAt DESC);
  `);

  const existing = new Set(/** @type {any[]} */ (db.prepare('PRAGMA table_info(diaries)').all()).map((r) => r.name));
  for (const c of TEXT_COLUMNS) {
    if (c === 'date') continue;
    if (!existing.has(c)) {
      db.exec(`ALTER TABLE diaries ADD COLUMN "${c}" TEXT NOT NULL DEFAULT ''`);
    }
  }
  return db;
}

function migrateFromJson(jsonPath) {
  if (!db) throw new Error('db not opened');
  if (!fs.existsSync(jsonPath)) return { migrated: 0 };
  const row = db.prepare('SELECT COUNT(*) AS n FROM diaries').get();
  if (row && row.n > 0) return { migrated: 0, skipped: true };

  let store;
  try {
    store = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    console.error('[db] 旧 JSON 解析失败，跳过迁移：', e);
    return { migrated: 0, error: e.message };
  }
  const entries = Object.values(store || {});
  if (entries.length === 0) return { migrated: 0 };

  const insert = prepareUpsert();
  const tx = db.transaction((items) => {
    for (const it of items) {
      insert.run(buildParams(it));
    }
  });
  tx(entries);

  const bak = `${jsonPath}.migrated-${Date.now()}.bak`;
  try {
    fs.renameSync(jsonPath, bak);
  } catch (e) {
    console.error('[db] 备份旧 JSON 失败（已忽略）：', e);
  }
  return { migrated: entries.length, backup: bak };
}

function buildParams(diary) {
  const out = { updatedAt: diary.updatedAt || '' };
  for (const c of TEXT_COLUMNS) {
    out[c] = typeof diary[c] === 'string' ? diary[c] : (diary[c] == null ? '' : String(diary[c]));
  }
  return out;
}

let upsertStmt = null;
function prepareUpsert() {
  if (upsertStmt) return upsertStmt;
  const cols = [...TEXT_COLUMNS, 'updatedAt'];
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const updates = cols.filter((c) => c !== 'date').map((c) => `"${c}"=excluded."${c}"`).join(', ');
  upsertStmt = db.prepare(`
    INSERT INTO diaries (${cols.map((c) => `"${c}"`).join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(date) DO UPDATE SET ${updates}
  `);
  return upsertStmt;
}

function rowToDiary(row) {
  if (!row) return null;
  const out = {};
  for (const c of TEXT_COLUMNS) out[c] = row[c] || '';
  out.updatedAt = row.updatedAt || '';
  return out;
}

function getDiary(date) {
  if (!db) throw new Error('db not opened');
  const row = db.prepare('SELECT * FROM diaries WHERE date = ?').get(date);
  return rowToDiary(row);
}

function saveDiary(payload) {
  if (!db) throw new Error('db not opened');
  if (!payload || !payload.date) throw new Error('保存失败：缺少日期');
  const now = new Date().toISOString();
  const merged = { ...payload, updatedAt: now };
  prepareUpsert().run(buildParams(merged));
  return getDiary(payload.date);
}

function deleteDiary(date) {
  if (!db) throw new Error('db not opened');
  db.prepare('DELETE FROM diaries WHERE date = ?').run(date);
  return { ok: true };
}

function listDiaries() {
  if (!db) throw new Error('db not opened');
  const titleParts = SEARCHABLE_COLUMNS.slice(0, 4); // 取前几项里第一个非空作为标题
  const rows = /** @type {any[]} */ (db.prepare(`
    SELECT date, weekday, updatedAt,
      "${titleParts[0]}" AS p0,
      "${titleParts[1]}" AS p1,
      "${titleParts[2]}" AS p2,
      "${titleParts[3]}" AS p3
    FROM diaries
    ORDER BY date DESC
  `).all());
  return rows.map((r) => ({
    date: r.date,
    weekday: r.weekday || '',
    updatedAt: r.updatedAt || '',
    title: (r.p0 || r.p1 || r.p2 || r.p3 || '').split(/\r?\n/)[0].slice(0, 40) || '（空）',
  }));
}

function searchDiaries(query, limit = 50) {
  if (!db) throw new Error('db not opened');
  const q = String(query || '').trim();
  if (!q) return listDiaries().slice(0, limit);
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const where = SEARCHABLE_COLUMNS.map((c) => `"${c}" LIKE ? ESCAPE '\\'`).join(' OR ');
  const selectCols = ['date', 'weekday', 'updatedAt', ...SEARCHABLE_COLUMNS].map((c) => `"${c}"`).join(', ');
  const stmt = db.prepare(`
    SELECT ${selectCols}
    FROM diaries
    WHERE ${where}
    ORDER BY date DESC
    LIMIT ?
  `);
  const params = /** @type {(string|number)[]} */ (SEARCHABLE_COLUMNS.map(() => like));
  params.push(limit);
  const rows = /** @type {any[]} */ (stmt.all(...params));
  const lowerQ = q.toLowerCase();
  return rows.map((r) => {
    let snippet = '';
    let snippetField = '';
    for (const c of SEARCHABLE_COLUMNS) {
      const v = String(r[c] || '');
      if (!v) continue;
      const idx = v.toLowerCase().indexOf(lowerQ);
      if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(v.length, idx + q.length + 60);
        snippet = (start > 0 ? '…' : '') + v.slice(start, end).replace(/\s+/g, ' ').trim() + (end < v.length ? '…' : '');
        snippetField = c;
        break;
      }
    }
    const title = String(r.constructionStatus || r.inspectionWork || '').split(/\r?\n/)[0].slice(0, 40) || '（空）';
    return {
      date: r.date,
      weekday: r.weekday || '',
      updatedAt: r.updatedAt || '',
      title,
      snippet,
      snippetField,
      query: q,
    };
  });
}

function close() {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
}

function dumpAll() {
  if (!db) throw new Error('db not opened');
  const cols = [...TEXT_COLUMNS, 'updatedAt'].map((c) => `"${c}"`).join(', ');
  const rows = /** @type {any[]} */ (db.prepare(`SELECT ${cols} FROM diaries ORDER BY date ASC`).all());
  return rows.map(rowToDiary).filter(Boolean);
}

function importAll(entries) {
  if (!db) throw new Error('db not opened');
  if (!Array.isArray(entries)) throw new Error('备份格式错误：diaries 不是数组');
  const insert = prepareUpsert();
  const tx = db.transaction((items) => {
    let n = 0;
    for (const it of items) {
      if (!it || !it.date) continue;
      insert.run(buildParams(it));
      n++;
    }
    return n;
  });
  return { imported: tx(entries) };
}

const HISTORY_ALLOWED_FIELDS = new Set([
  'contractorPersonnel',
  'machinery',
  'materialAcceptance',
  'inspectionWork',
  'acceptanceWork',
  'standingWork',
  'meeting',
  'internalWork',
  'issuesAndActions',
  'otherMatters',
  'constructionStatus',
]);

function getFieldHistory(field, limit = 8) {
  if (!db) throw new Error('db not opened');
  if (!HISTORY_ALLOWED_FIELDS.has(field)) throw new Error('该字段不支持历史检索');
  const n = Math.min(Math.max(1, Number(limit) || 8), 50);
  const rows = /** @type {any[]} */ (db.prepare(`
    SELECT date, "${field}" AS value
    FROM diaries
    WHERE "${field}" IS NOT NULL AND TRIM("${field}") <> ''
    ORDER BY date DESC
  `).all());
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const v = String(r.value || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push({ date: r.date, value: v });
    if (out.length >= n) break;
  }
  return out;
}

module.exports = {
  open,
  close,
  migrateFromJson,
  getDiary,
  saveDiary,
  deleteDiary,
  listDiaries,
  searchDiaries,
  dumpAll,
  importAll,
  getFieldHistory,
};
