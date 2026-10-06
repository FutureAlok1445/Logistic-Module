// Single Render process supervisor: API stays on loopback; Next exposes PORT.
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const children = new Set();
let stopping = false;
const publicPort = process.env.PORT || '3000';
const frontendUrl = process.env.RENDER_EXTERNAL_URL || process.env.FRONTEND_URL;
if (!frontendUrl) throw new Error('Set FRONTEND_URL or deploy on Render');
if (publicPort === '4000') throw new Error('Public PORT must differ from internal API port 4000');
const env = { ...process.env, FRONTEND_URL: frontendUrl, NODE_ENV: 'production' };
function run(args, cwd, extra = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { cwd, env: { ...env, ...extra }, stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', code => code === 0 ? resolve() : reject(new Error('Demo setup failed')));
  });
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of children) p.kill('SIGTERM');
  setTimeout(() => process.exit(code), 250).unref();
}
function serve(args, cwd, extra) {
  const p = spawn(process.execPath, args, { cwd, env: { ...env, ...extra }, stdio: 'inherit' });
  children.add(p);
  p.on('error', () => stop(1));
  p.on('exit', () => { children.delete(p); if (!stopping) stop(1); });
}
async function main() {
  const backend = path.join(root, 'apps/backend');
  await run([require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], backend);
  await run([require.resolve('tsx/cli'), 'prisma/seed.ts'], backend);
  serve(['dist/server.js'], backend, { PORT: '4000', API_HOST: '127.0.0.1', ADMIN_PASSWORD: '', DEMO_PASSWORD: '' });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:4000/ready')).ok) { ready = true; break; } } catch { /* Wait for API startup. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Demo API did not become ready');
  const frontend = path.join(root, 'apps/frontend');
  await run(['scripts/prepare-standalone.cjs'], frontend);
  serve(['.next/standalone/apps/frontend/server.js'], frontend, { PORT: publicPort, HOSTNAME: '0.0.0.0', API_INTERNAL_URL: 'http://127.0.0.1:4000', ADMIN_PASSWORD: '', DEMO_PASSWORD: '' });
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
main().catch(() => { console.error('Demo startup failed. Check database connectivity and demo environment settings.'); stop(1); process.exitCode = 1; });
