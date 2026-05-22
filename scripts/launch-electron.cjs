#!/usr/bin/env node
// @ts-check
// Launches Electron with ELECTRON_RUN_AS_NODE removed from env.
// Some machines set ELECTRON_RUN_AS_NODE=1 globally (interferes with Electron API).
const { spawn } = require('child_process');
const path = require('path');

/** @type {string} */
const electron = /** @type {any} */ (require('electron'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, [path.resolve(__dirname, '..')], {
  stdio: 'inherit',
  env,
  windowsHide: false,
});
child.on('close', (code, signal) => {
  if (code === null) {
    console.error('electron exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});
/** @type {NodeJS.Signals[]} */
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((sig) => {
  process.on(sig, () => { if (!child.killed) child.kill(sig); });
});
