require('dotenv').config({ path: 'apps/backend/.env', quiet: true });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT 1').then(() => console.info('Database reachable')).catch(() => { console.info('Database unavailable'); process.exitCode = 1; }).finally(() => p.$disconnect());
