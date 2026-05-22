// @ts-check
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB per file
const MAX_FILES = 5;

let logDir = null;
let logFile = null;
let started = false;

function ensureDir() {
  if (!logDir) throw new Error('logger not initialized');
  fs.mkdirSync(logDir, { recursive: true });
}

function rotateIfNeeded() {
  if (!logFile) return;
  let size = 0;
  try {
    size = fs.statSync(logFile).size;
  } catch {
    return;
  }
  if (size < MAX_BYTES) return;

  for (let i = MAX_FILES - 1; i >= 1; i--) {
    const from = `${logFile}.${i}`;
    const to = `${logFile}.${i + 1}`;
    try {
      if (fs.existsSync(from)) {
        if (i + 1 > MAX_FILES) fs.unlinkSync(from);
        else fs.renameSync(from, to);
      }
    } catch { /* ignore */ }
  }
  try {
    fs.renameSync(logFile, `${logFile}.1`);
  } catch { /* ignore */ }
  const overflow = `${logFile}.${MAX_FILES + 1}`;
  try { if (fs.existsSync(overflow)) fs.unlinkSync(overflow); } catch { /* ignore */ }
}

function writeLine(level, args) {
  if (!logFile) return;
  try {
    rotateIfNeeded();
    const ts = new Date().toISOString();
    const parts = args.map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    });
    const line = `[${ts}] [${level}] ${parts.join(' ')}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
  } catch { /* swallow logging errors */ }
}

/**
 * @param {string} dir
 */
function start(dir) {
  if (started) return;
  logDir = dir;
  logFile = path.join(logDir, 'app.log');
  ensureDir();

  const origLog = console.log.bind(console);
  const origInfo = console.info.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args) => { writeLine('LOG', args); origLog(...args); };
  console.info = (...args) => { writeLine('INFO', args); origInfo(...args); };
  console.warn = (...args) => { writeLine('WARN', args); origWarn(...args); };
  console.error = (...args) => { writeLine('ERROR', args); origError(...args); };

  process.on('uncaughtException', (err) => {
    writeLine('FATAL', ['uncaughtException', err]);
    origError('uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    writeLine('FATAL', ['unhandledRejection', reason]);
    origError('unhandledRejection', reason);
  });

  writeLine('INFO', ['===== app started, pid=' + process.pid + ' =====']);
  started = true;
}

function getDir() {
  return logDir;
}

function getFile() {
  return logFile;
}

module.exports = { start, getDir, getFile };
