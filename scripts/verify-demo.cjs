const { randomUUID, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.resolve('apps/backend/.env'), quiet: true });
async function main() {
  const admin = new PrismaClient();
  const database = `elms_demo_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: url.toString(), DEMO_MODE: 'true', DEMO_PASSWORD: randomBytes(24).toString('hex') };
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const cwd = path.resolve('apps/backend');
  const execute = args => spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
  try {
    assert.equal(execute([require.resolve('prisma/build/index.js'), 'migrate', 'deploy']).status, 0, 'Demo test migration failed');
    const bootstrap = () => execute([require.resolve('tsx/cli'), 'scripts/bootstrap-demo.ts']);
    assert.equal(bootstrap().status, 0, 'Demo bootstrap failed');
    assert.equal(await db.employee.count(), 5);
    assert.equal(await db.workbookDataset.count(), 5);
    const manager = await db.employee.findUniqueOrThrow({ where: { email: 'manager@demo.example' } });
    const workbook = await db.workbookDataset.findFirstOrThrow({ where: { ownerId: manager.id } });
    assert.ok(Array.isArray(workbook.sheets));
    assert.equal(workbook.rowCount, 6);
    await db.teamMessage.create({ data: { senderId: manager.id, body: 'Reviewer test record' } });
    env.DEMO_PASSWORD = randomBytes(24).toString('hex');
    assert.equal(bootstrap().status, 0, 'Demo restart bootstrap failed');
    assert.equal((await db.employee.findUniqueOrThrow({ where: { id: manager.id } })).passwordHash, manager.passwordHash);
    assert.equal(await db.teamMessage.count(), 1);
    await db.systemSetting.delete({ where: { key: 'demoBootstrap' } });
    await db.employee.update({ where: { id: manager.id }, data: { email: 'employee@business.example' } });
    assert.notEqual(bootstrap().status, 0, 'Demo bootstrap must reject existing business employees');
    assert.equal(await db.employee.count(), 5);
    console.log('Demo verification passed: five roles, private sample workbooks, restart persistence, credential preservation and business-data guard.');
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}
main().catch(() => { console.error('Isolated demo verification failed. No operational database was reset.'); process.exitCode = 1; });
