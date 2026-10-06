const { randomBytes } = require('node:crypto');
const { appendFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config({ quiet: true });
async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local credential helper is disabled in production');
  const db = new PrismaClient();
  const roles = [['LOGISTICS_MANAGER','manager','Logistics Manager'],['DISPATCH_EXECUTIVE','dispatch','Dispatch Executive'],['WAREHOUSE_STAFF','warehouse','Warehouse Staff'],['VIEWER_AUDITOR','auditor','Viewer Auditor']];
  const lines = ['\n## Additional local employee logins\n', 'Created for role verification at http://localhost:3000. Change passwords before real operations.\n'];
  try {
    for(const [role, alias, name] of roles) {
      const email = `${alias}@elms.local`;
      if(await db.employee.findUnique({where:{email}})) { lines.push(`- ${role}: ${email} — existing password preserved.\n`); continue; }
      const password = randomBytes(18).toString('base64url') + '!9';
      const passwordHash = await bcrypt.hash(password,12);
      await db.$transaction(async tx=>{
        const user=await tx.employee.create({data:{email,fullName:name,role,passwordHash,profile:{create:{jobTitle:name,department:'Logistics'}}}});
        await tx.auditLog.create({data:{employeeId:user.id,action:'LOCAL_ROLE_BOOTSTRAP',entity:'Employee',entityId:user.id}});
      });
      lines.push(`- ${role}: ${email} | Password: \`${password}\`\n`);
    }
    appendFileSync(resolve('../..','LOCAL_ACCESS.md'),lines.join(''));
    process.stdout.write('Local role accounts created; credentials saved to ignored LOCAL_ACCESS.md. Existing accounts preserved.\n');
  } finally { await db.$disconnect(); }
}
run().catch(()=>{process.stderr.write('Role bootstrap failed; check local database.\n');process.exitCode=1;});
