const { spawnSync } = require('node:child_process');
const path = require('node:path');
const run = spawnSync(process.execPath, [path.resolve('apps/backend/scripts/test-integration.cjs')], { cwd: path.resolve('apps/backend'), env: { ...process.env, E2E: '1' }, stdio: 'inherit' });
process.exitCode = run.status ?? 1;
