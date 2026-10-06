import { PrismaClient, EmployeeRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
const prisma = new PrismaClient();
async function main() {
  if (process.env.DEMO_MODE !== "true")
    throw new Error("Explicit demo mode required");
  const password = z.string().min(12).parse(process.env.DEMO_PASSWORD);
  // Never mix fabricated employee data into an existing business database.
  const marker = await prisma.systemSetting.findUnique({
    where: { key: "demoBootstrap" },
  });
  if (
    !marker &&
    ((await prisma.employee.count({
      where: { NOT: { email: { endsWith: "@demo.example" } } },
    })) ||
      (await prisma.student.count()))
  )
    throw new Error("Use a separate empty demo database");
  const passwordHash = await bcrypt.hash(password, 12);
  const accounts: [EmployeeRole, string, string][] = [
    ["SUPER_ADMIN", "admin", "Demo Administrator"],
    ["LOGISTICS_MANAGER", "manager", "Demo Logistics Manager"],
    ["DISPATCH_EXECUTIVE", "dispatch", "Demo Dispatch Executive"],
    ["WAREHOUSE_STAFF", "warehouse", "Demo Warehouse Staff"],
    ["VIEWER_AUDITOR", "viewer", "Demo Auditor"],
  ];
  for (const [role, name, fullName] of accounts) {
    const email = `${name}@demo.example`;
    const employee = await prisma.employee.upsert({
      where: { email },
      create: {
        email,
        fullName,
        passwordHash,
        role,
        profile: {
          create: {
            jobTitle: fullName.replace("Demo ", ""),
            department: "Logistics",
            statusMessage: "Manager demo · fictional records",
          },
        },
      },
      update: {},
    });
    const id = `demo-workbook-${name}`;
    await prisma.workbookDataset.upsert({
      where: { id },
      create: {
        id,
        ownerId: employee.id,
        name: "Sample operations · fictional",
        filename: "demo-sample.csv",
        rowCount: 6,
        sheets: [
          {
            name: "Dispatch sample",
            rows: [
              ["Reference", "City", "Status", "Amount"],
              ["DEMO-001", "Mumbai", "Packed", "2400"],
              ["DEMO-002", "Delhi", "Payment hold", "3200"],
              ["DEMO-003", "Mumbai", "Delivered", "1800"],
              ["DEMO-004", "Pune", "Queued", "2100"],
              ["DEMO-005", "Delhi", "Packed", "2900"],
              ["DEMO-006", "Pune", "Delivered", "1600"],
            ],
          },
        ],
      },
      update: {},
    });
  }
  await prisma.systemSetting.upsert({
    where: { key: "demoBootstrap" },
    create: { key: "demoBootstrap", value: true },
    update: {},
  });
  console.log(
    "Demo accounts and sample analytical workbooks ready. Existing credentials preserved.",
  );
}
main()
  .catch(() => {
    console.error(
      "Demo bootstrap failed. Use a separate demo database and a 12-character DEMO_PASSWORD.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
