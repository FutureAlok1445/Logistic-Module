import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const existing = await prisma.employee.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
  if (!existing) {
    const setup = z.object({ ADMIN_EMAIL: z.string().email(), ADMIN_PASSWORD: z.string().min(12), ADMIN_NAME: z.string().default('System Administrator') }).parse(process.env);
    await prisma.employee.create({ data: { email: setup.ADMIN_EMAIL.toLowerCase(), passwordHash: await bcrypt.hash(setup.ADMIN_PASSWORD, 12), fullName: setup.ADMIN_NAME, role: 'SUPER_ADMIN' } });
  }
  const templates: Record<string, string> = { PACKED: 'Hi [Name], your [Course] [Kit] is packed and ready for dispatch.', HANDED_TO_COURIER: 'Your [Course] [Kit] is on its way. Courier: [Courier]. AWB: [AWB]. Estimated delivery: [Date].', OUT_FOR_DELIVERY: 'Hi [Name], your [Kit] is out for delivery today.', DELIVERED: 'Hi [Name], your [Course] [Kit] has been delivered.', FAILED_DELIVERY: 'Hi [Name], delivery of your [Kit] failed. Please contact your centre to confirm your address.', TRANSFER_CONFIRMED: 'Hi [Name], your transfer to [Course] is confirmed. Dispatch follows Finance clearance.' };
  for (const [event, content] of Object.entries(templates)) await prisma.notificationTemplate.upsert({ where: { event }, create: { event, content }, update: {} });
  for (const [key, value] of Object.entries({ forecastBufferPercent: 5, piiRetentionYears: 3 })) await prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  process.stdout.write('Bootstrap complete. Existing employee credentials and business records preserved.\n');
}
main().catch(() => { process.stderr.write('Bootstrap failed. Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) when creating the first administrator.\n'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
