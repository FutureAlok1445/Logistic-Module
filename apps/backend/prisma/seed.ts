import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1 Super Admin
  const admin = await prisma.employee.upsert({
    where: { email: 'admin@elms.logistics.local' },
    update: {},
    create: {
      email: 'admin@elms.logistics.local',
      passwordHash: 'seeded-hash', // use bcrypt in real life
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  // 5 Courses
  const courses = [
    { code: 'C101', name: 'JEE Mains Master' },
    { code: 'C102', name: 'NEET Vision' },
    { code: 'C103', name: 'UPSC Foundation' },
    { code: 'C104', name: 'GATE Prelude' },
    { code: 'C105', name: 'CA FastTrack' },
  ];
  for (const c of courses) {
    await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  // 6 Centers
  const centers = [
    { code: 'DEL01', name: 'Delhi Hub', city: 'Delhi', state: 'Delhi' },
    { code: 'MUM01', name: 'Mumbai Express', city: 'Mumbai', state: 'Maharashtra' },
    { code: 'BLR01', name: 'Bangalore Tech', city: 'Bangalore', state: 'Karnataka' },
    { code: 'HYD01', name: 'Hyderabad Spark', city: 'Hyderabad', state: 'Telangana' },
    { code: 'CJB01', name: 'Coimbatore Rise', city: 'Coimbatore', state: 'Tamil Nadu' },
    { code: 'KOL01', name: 'Kolkata Central', city: 'Kolkata', state: 'West Bengal' },
  ];
  for (const c of centers) {
    await prisma.center.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  // 3 Couriers
  const couriers = [
    { name: 'BlueDart', trackingUrl: 'https://bluedart.com/track?awb=' },
    { name: 'Delhivery', trackingUrl: 'https://delhivery.com/track?awb=' },
    { name: 'EcomExpress', trackingUrl: 'https://ecomexpress.in/track?awb=' }
  ];
  for (const c of couriers) {
    // Upsert equivalent since we don't have unique constraint on name, we will just create
    const existing = await prisma.courierPartner.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.courierPartner.create({ data: c });
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });