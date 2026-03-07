// Launch Electron with ELECTRON_RUN_AS_NODE removed from environment
// (Claude Code SDK sets ELECTRON_RUN_AS_NODE=1 which prevents GUI mode)
const { execFileSync } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
execFileSync(electronPath, ['.'], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env,
});
