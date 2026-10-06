const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ quiet: true });
async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Use explicit administrator credentials in production');
  const p = new PrismaClient();
  try {
    if (!await p.employee.count({ where: { role: 'SUPER_ADMIN', isActive: true } })) {
      const email = 'admin@elms.local'; const password = randomBytes(18).toString('base64url');
      const envPath = path.resolve('.env');
      fs.appendFileSync(envPath, `\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`);
      fs.writeFileSync(path.resolve('../../LOCAL_ACCESS.md'), `# Local ELMS access\n\nURL: http://localhost:3000\n\nEmail: ${email}\n\nPassword: ${password}\n\nChange the password after first login. This file is excluded from Git.\n`);
      process.stdout.write('Local administrator configuration written to ignored environment file. Credentials: LOCAL_ACCESS.md\n');
    }
  } finally { await p.$disconnect(); }
}
run().catch(() => { process.stderr.write('Local bootstrap failed. Check database availability.\n'); process.exitCode = 1; });
