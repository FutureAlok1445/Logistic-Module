const { randomUUID } = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ quiet: true });

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for isolated integration tests');
  const admin = new PrismaClient();
  const database = `elms_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.pathname = `/${database}`; url.searchParams.set('schema', 'public');
  const testEnv = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:3000', JWT_ACCESS_SECRET: randomUUID().repeat(2), JWT_REFRESH_SECRET: randomUUID().repeat(2), ADMISSIONS_API_KEY: randomUUID().repeat(2), FINANCE_API_KEY: randomUUID().repeat(2) };
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
  try {
    const migrate = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: testEnv, stdio: 'inherit' });
    if (migrate.status !== 0) throw new Error('Test migration failed');
    const test = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'test/integration.test.ts'], { env: testEnv, stdio: 'inherit' });
    process.exitCode = test.status ?? 1;
    if (test.status === 0 && process.env.E2E === '1') {
      const combined = spawn(process.execPath, ['scripts/start-demo.cjs'], { cwd: path.resolve('../..'), env: { ...testEnv, NODE_ENV: 'production', PORT: '3000', DEMO_MODE: 'false', ADMIN_EMAIL: '', ADMIN_PASSWORD: '', API_INTERNAL_URL: 'http://127.0.0.1:4000' }, stdio: 'inherit' });
      try {
        for (let i = 0; i < 60; i++) { try { const r = await fetch('http://localhost:3000'); const api = await fetch('http://localhost:4000/ready'); if (r.ok && api.ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
        const e2e = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', 'playwright.config.ts', ...(process.env.PLAYWRIGHT_GREP ? ['--grep', process.env.PLAYWRIGHT_GREP] : [])], { cwd: path.resolve('../..'), env: testEnv, stdio: 'inherit' });
        process.exitCode = e2e.status ?? 1;
      } finally {
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(combined.pid), '/T', '/F'], { stdio: 'ignore' });
        else combined.kill('SIGTERM');
      }
    }
  } finally {
    // Only the temporary database generated above is removed; operational database is untouched.
    await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}
run().catch(() => { process.stderr.write('Integration run failed. Check isolated test database permissions.\n'); process.exitCode = 1; });
