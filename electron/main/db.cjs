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

  const existing = new Set(db.prepare('PRAGMA table_info(diaries)').all().map((r) => r.name));
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
  const rows = db.prepare(`
    SELECT date, weekday, updatedAt,
      "${titleParts[0]}" AS p0,
      "${titleParts[1]}" AS p1,
      "${titleParts[2]}" AS p2,
      "${titleParts[3]}" AS p3
    FROM diaries
    ORDER BY date DESC
  `).all();
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
  const stmt = db.prepare(`
    SELECT date, weekday, updatedAt,
      "constructionStatus" AS p0, "inspectionWork" AS p1
    FROM diaries
    WHERE ${where}
    ORDER BY date DESC
    LIMIT ?
  `);
  const params = SEARCHABLE_COLUMNS.map(() => like);
  params.push(limit);
  const rows = stmt.all(...params);
  return rows.map((r) => ({
    date: r.date,
    weekday: r.weekday || '',
    updatedAt: r.updatedAt || '',
    title: (r.p0 || r.p1 || '').split(/\r?\n/)[0].slice(0, 40) || '（空）',
  }));
}

function close() {
  if (db) {
    try { db.close(); } catch { /* ignore */ }
    db = null;
  }
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
};
