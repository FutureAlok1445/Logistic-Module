import 'dotenv/config';
import { PrismaClient, EmployeeRole, StudentStatus, DispatchStatus, DeliveryMode } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seed...');

  const password = process.env.DEMO_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@12345678';
  const passwordHash = await bcrypt.hash(password, 10);

  // ─────────────────────────────────────────────────────────────
  // 1. EMPLOYEES & PROFILES (All 5 Roles)
  // ─────────────────────────────────────────────────────────────
  const employeesData: { role: EmployeeRole; email: string; fullName: string; jobTitle: string; phone: string; location: string }[] = [
    {
      role: 'SUPER_ADMIN',
      email: (process.env.ADMIN_EMAIL || 'admin@demo.example').toLowerCase(),
      fullName: 'System Administrator',
      jobTitle: 'Head of Technology & Systems',
      phone: '+91 98200 11001',
      location: 'Mumbai Central Headquarters',
    },
    {
      role: 'LOGISTICS_MANAGER',
      email: 'manager@demo.example',
      fullName: 'Rajesh Sharma',
      jobTitle: 'National Logistics & Supply Chain Manager',
      phone: '+91 98200 11002',
      location: 'Mumbai Central Hub',
    },
    {
      role: 'DISPATCH_EXECUTIVE',
      email: 'dispatch@demo.example',
      fullName: 'Priya Nair',
      jobTitle: 'Lead Dispatch Operations Executive',
      phone: '+91 98200 11003',
      location: 'Delhi NCR Hub',
    },
    {
      role: 'WAREHOUSE_STAFF',
      email: 'warehouse@demo.example',
      fullName: 'Amit Verma',
      jobTitle: 'Warehouse Supervisor & Packing Station Lead',
      phone: '+91 98200 11004',
      location: 'Mumbai Central Hub',
    },
    {
      role: 'VIEWER_AUDITOR',
      email: 'viewer@demo.example',
      fullName: 'Sunita Rao',
      jobTitle: 'Senior Finance & Operations Auditor',
      phone: '+91 98200 11005',
      location: 'Bengaluru Regional Office',
    },
  ];

  const employees: Record<string, any> = {};
  for (const emp of employeesData) {
    const record = await prisma.employee.upsert({
      where: { email: emp.email },
      create: {
        email: emp.email,
        fullName: emp.fullName,
        passwordHash,
        role: emp.role,
        isActive: true,
        profile: {
          create: {
            jobTitle: emp.jobTitle,
            department: 'Logistics Operations',
            phone: emp.phone,
            location: emp.location,
            statusMessage: 'Active on duty',
            availability: 'AVAILABLE',
          },
        },
      },
      update: {
        fullName: emp.fullName,
        role: emp.role,
        isActive: true,
      },
      include: { profile: true },
    });
    employees[emp.role] = record;
  }
  console.log('✓ Seeded 5 Employees with profiles');

  // ─────────────────────────────────────────────────────────────
  // 2. REGIONAL CENTERS
  // ─────────────────────────────────────────────────────────────
  const centersData = [
    { code: 'MUM-01', name: 'Mumbai Central Logistics Hub', city: 'Mumbai', state: 'Maharashtra' },
    { code: 'DEL-01', name: 'Delhi NCR Fulfilment Centre', city: 'New Delhi', state: 'Delhi' },
    { code: 'BLR-01', name: 'Bengaluru South Distribution Hub', city: 'Bengaluru', state: 'Karnataka' },
    { code: 'PUN-01', name: 'Pune Regional Centre', city: 'Pune', state: 'Maharashtra' },
    { code: 'KOL-01', name: 'Kolkata Eastern Depot', city: 'Kolkata', state: 'West Bengal' },
  ];

  const centers: Record<string, any> = {};
  for (const c of centersData) {
    centers[c.code] = await prisma.center.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }
  console.log('✓ Seeded 5 Regional Distribution Centres');

  // ─────────────────────────────────────────────────────────────
  // 3. COURSES & PRICING
  // ─────────────────────────────────────────────────────────────
  const coursesData = [
    { code: 'CAT-2026', name: 'CAT Comprehensive 2026 Masterclass', fee: 65000.0 },
    { code: 'GMAT-FOC', name: 'GMAT Focus Edition Complete Batch', fee: 48000.0 },
    { code: 'UPSC-2027', name: 'UPSC Civil Services Foundation GS Pack', fee: 85000.0 },
    { code: 'GATE-CS', name: 'GATE Computer Science & IT Pack', fee: 38000.0 },
    { code: 'BANK-PO', name: 'Banking PO & Clerical Fast-Track', fee: 24000.0 },
  ];

  const courses: Record<string, any> = {};
  for (const c of coursesData) {
    courses[c.code] = await prisma.course.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, fee: c.fee },
      update: { name: c.name, fee: c.fee },
    });

    for (const center of Object.values(centers)) {
      await prisma.coursePrice.upsert({
        where: { courseId_centerId: { courseId: courses[c.code].id, centerId: center.id } },
        create: { courseId: courses[c.code].id, centerId: center.id, fee: c.fee },
        update: { fee: c.fee },
      });
    }
  }
  console.log('✓ Seeded 5 Courses with centre pricing');

  // ─────────────────────────────────────────────────────────────
  // 4. PAYMENT PLANS
  // ─────────────────────────────────────────────────────────────
  const plansData = [
    { name: 'Full Upfront Payment (100%)' },
    { name: 'Two-Stage Milestone Plan (50% - 50%)' },
    { name: 'Four-Stage Quarterly Plan (25% x 4)' },
  ];

  const paymentPlans: any[] = [];
  for (const p of plansData) {
    const existing = await prisma.paymentPlan.findFirst({ where: { name: p.name } });
    if (existing) {
      paymentPlans.push(existing);
    } else {
      paymentPlans.push(await prisma.paymentPlan.create({ data: p }));
    }
  }
  console.log('✓ Seeded Payment Plans');

  // ─────────────────────────────────────────────────────────────
  // 5. INVENTORY CATALOGUE (Items & SKUs)
  // ─────────────────────────────────────────────────────────────
  const inventoryData = [
    { sku: 'BK-CAT-QA01', name: 'CAT Quantitative Aptitude Vol 1', pages: 420, unitCost: 350.0, lowStockThreshold: 25 },
    { sku: 'BK-CAT-VAR01', name: 'CAT Verbal Ability & Reading Comprehension', pages: 380, unitCost: 320.0, lowStockThreshold: 20 },
    { sku: 'BK-CAT-DILR', name: 'CAT Data Interpretation & Logical Reasoning', pages: 440, unitCost: 380.0, lowStockThreshold: 20 },
    { sku: 'BK-GMAT-OG', name: 'GMAT Focus Official Practice Guidebook', pages: 520, unitCost: 550.0, lowStockThreshold: 15 },
    { sku: 'BK-UPSC-GS1', name: 'UPSC GS Paper 1: History & Heritage Guide', pages: 640, unitCost: 460.0, lowStockThreshold: 25 },
    { sku: 'BK-UPSC-GS2', name: 'UPSC GS Paper 2: Governance & Constitution', pages: 590, unitCost: 430.0, lowStockThreshold: 25 },
    { sku: 'BK-GATE-DS', name: 'GATE CS Data Structures & Algorithms Problem Bank', pages: 480, unitCost: 370.0, lowStockThreshold: 20 },
    { sku: 'ST-BAG-ELMS', name: 'IMS Branded Heavy Duty Student Backpack', pages: 0, unitCost: 480.0, lowStockThreshold: 30 },
    { sku: 'ST-STAT-KIT', name: 'IMS Formula Pocket Cards & Study Diary', pages: 64, unitCost: 120.0, lowStockThreshold: 40 },
  ];

  const items: Record<string, any> = {};
  for (const item of inventoryData) {
    items[item.sku] = await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      create: item,
      update: item,
    });
  }
  console.log('✓ Seeded 9 Inventory Material SKUs');

  // ─────────────────────────────────────────────────────────────
  // 6. KITS & BILL OF MATERIALS (BOM)
  // ─────────────────────────────────────────────────────────────
  const kitsData = [
    {
      name: 'CAT 2026 Foundation Module (Pack 1)',
      courseCode: 'CAT-2026',
      milestoneNumber: 1,
      weightKg: 3.2,
      components: [
        { sku: 'BK-CAT-QA01', qty: 1 },
        { sku: 'BK-CAT-VAR01', qty: 1 },
        { sku: 'BK-CAT-DILR', qty: 1 },
        { sku: 'ST-BAG-ELMS', qty: 1 },
      ],
    },
    {
      name: 'CAT 2026 Advanced Mock Workbook (Pack 2)',
      courseCode: 'CAT-2026',
      milestoneNumber: 2,
      weightKg: 1.8,
      components: [
        { sku: 'BK-CAT-QA01', qty: 1 },
        { sku: 'ST-STAT-KIT', qty: 1 },
      ],
    },
    {
      name: 'GMAT Focus Complete Book Bundle',
      courseCode: 'GMAT-FOC',
      milestoneNumber: 1,
      weightKg: 2.6,
      components: [
        { sku: 'BK-GMAT-OG', qty: 1 },
        { sku: 'ST-BAG-ELMS', qty: 1 },
        { sku: 'ST-STAT-KIT', qty: 1 },
      ],
    },
    {
      name: 'UPSC Foundation Core Literature Set',
      courseCode: 'UPSC-2027',
      milestoneNumber: 1,
      weightKg: 5.4,
      components: [
        { sku: 'BK-UPSC-GS1', qty: 1 },
        { sku: 'BK-UPSC-GS2', qty: 1 },
        { sku: 'ST-BAG-ELMS', qty: 1 },
      ],
    },
    {
      name: 'GATE CS Core Theory & Problem Bank',
      courseCode: 'GATE-CS',
      milestoneNumber: 1,
      weightKg: 2.5,
      components: [
        { sku: 'BK-GATE-DS', qty: 1 },
        { sku: 'ST-STAT-KIT', qty: 1 },
      ],
    },
  ];

  const kits: Record<string, any> = {};
  for (const k of kitsData) {
    const existing = await prisma.kit.findFirst({ where: { name: k.name } });
    let kitRecord;
    if (existing) {
      kitRecord = await prisma.kit.update({
        where: { id: existing.id },
        data: {
          courseId: courses[k.courseCode].id,
          milestoneNumber: k.milestoneNumber,
          weightKg: k.weightKg,
        },
      });
    } else {
      kitRecord = await prisma.kit.create({
        data: {
          name: k.name,
          courseId: courses[k.courseCode].id,
          milestoneNumber: k.milestoneNumber,
          weightKg: k.weightKg,
        },
      });
    }
    kits[k.name] = kitRecord;

    for (const comp of k.components) {
      await prisma.kitItem.upsert({
        where: { kitId_itemId: { kitId: kitRecord.id, itemId: items[comp.sku].id } },
        create: { kitId: kitRecord.id, itemId: items[comp.sku].id, quantity: comp.qty },
        update: { quantity: comp.qty },
      });
    }
  }
  console.log('✓ Seeded 5 Course Kits & BOM Component linkages');

  // ─────────────────────────────────────────────────────────────
  // 7. MULTI-LOCATION STOCK
  // ─────────────────────────────────────────────────────────────
  const baseQuantities: Record<string, Record<string, number>> = {
    'MUM-01': {
      'BK-CAT-QA01': 340,
      'BK-CAT-VAR01': 280,
      'BK-CAT-DILR': 310,
      'BK-GMAT-OG': 180,
      'BK-UPSC-GS1': 190,
      'BK-UPSC-GS2': 210,
      'BK-GATE-DS': 140,
      'ST-BAG-ELMS': 450,
      'ST-STAT-KIT': 600,
    },
    'DEL-01': {
      'BK-CAT-QA01': 220,
      'BK-CAT-VAR01': 190,
      'BK-CAT-DILR': 175,
      'BK-GMAT-OG': 95,
      'BK-UPSC-GS1': 260,
      'BK-UPSC-GS2': 240,
      'BK-GATE-DS': 80,
      'ST-BAG-ELMS': 220,
      'ST-STAT-KIT': 310,
    },
    'BLR-01': {
      'BK-CAT-QA01': 180,
      'BK-CAT-VAR01': 140,
      'BK-CAT-DILR': 160,
      'BK-GMAT-OG': 120,
      'BK-UPSC-GS1': 70,
      'BK-UPSC-GS2': 65,
      'BK-GATE-DS': 190,
      'ST-BAG-ELMS': 180,
      'ST-STAT-KIT': 220,
    },
    'PUN-01': {
      'BK-CAT-QA01': 45,
      'BK-CAT-VAR01': 35,
      'BK-CAT-DILR': 12, // low stock trigger
      'BK-GMAT-OG': 22,
      'BK-UPSC-GS1': 18,
      'BK-UPSC-GS2': 15,
      'BK-GATE-DS': 14,
      'ST-BAG-ELMS': 50,
      'ST-STAT-KIT': 80,
    },
    'KOL-01': {
      'BK-CAT-QA01': 60,
      'BK-CAT-VAR01': 55,
      'BK-CAT-DILR': 40,
      'BK-GMAT-OG': 18,
      'BK-UPSC-GS1': 30,
      'BK-UPSC-GS2': 32,
      'BK-GATE-DS': 25,
      'ST-BAG-ELMS': 70,
      'ST-STAT-KIT': 90,
    },
  };

  for (const [centerCode, stockMap] of Object.entries(baseQuantities)) {
    const center = centers[centerCode];
    for (const [sku, qty] of Object.entries(stockMap)) {
      const item = items[sku];
      await prisma.stock.upsert({
        where: { itemId_centerId: { itemId: item.id, centerId: center.id } },
        create: { itemId: item.id, centerId: center.id, quantity: qty, damaged: sku === 'BK-CAT-QA01' ? 3 : 0 },
        update: { quantity: qty },
      });
    }
  }
  console.log('✓ Seeded Stock balances across 5 Regional Warehouses');

  // ─────────────────────────────────────────────────────────────
  // 8. COURIER PARTNERS & DISPATCH ROUTING RULES
  // ─────────────────────────────────────────────────────────────
  const couriersData = [
    { name: 'Blue Dart Express', trackingUrl: 'https://www.bluedart.com/tracking?awb=' },
    { name: 'Delhivery Surface & Express', trackingUrl: 'https://www.delhivery.com/track/package/' },
    { name: 'DTDC Courier Air Network', trackingUrl: 'https://www.dtdc.in/tracking.asp?awb=' },
    { name: 'India Post Speed Post', trackingUrl: 'https://www.indiapost.gov.in/_layouts/15/dpt.ptis.tracking/track.aspx?awb=' },
  ];

  const couriers: Record<string, any> = {};
  for (const c of couriersData) {
    const existing = await prisma.courierPartner.findFirst({ where: { name: c.name } });
    if (existing) {
      couriers[c.name] = existing;
    } else {
      couriers[c.name] = await prisma.courierPartner.create({ data: c });
    }
  }

  const rulesData = [
    { courier: 'Blue Dart Express', state: 'Maharashtra', priority: 1 },
    { courier: 'Delhivery Surface & Express', state: 'Maharashtra', priority: 2 },
    { courier: 'Blue Dart Express', state: 'Delhi', priority: 1 },
    { courier: 'Delhivery Surface & Express', state: 'Delhi', priority: 2 },
    { courier: 'Blue Dart Express', state: 'Karnataka', priority: 1 },
    { courier: 'DTDC Courier Air Network', state: 'Karnataka', priority: 2 },
    { courier: 'Delhivery Surface & Express', state: 'West Bengal', priority: 1 },
    { courier: 'DTDC Courier Air Network', state: 'West Bengal', priority: 2 },
  ];

  for (const r of rulesData) {
    await prisma.courierRule.upsert({
      where: { state_priority: { state: r.state, priority: r.priority } },
      create: { state: r.state, priority: r.priority, courierPartnerId: couriers[r.courier].id },
      update: { courierPartnerId: couriers[r.courier].id },
    });
  }
  console.log('✓ Seeded Courier Partners & State dispatch routing rules');

  // ─────────────────────────────────────────────────────────────
  // 9. SERVICEABLE PINCODES
  // ─────────────────────────────────────────────────────────────
  const pincodesData = [
    { code: '400001', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '400050', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '400076', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '110001', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '110016', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '110092', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '560001', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '560034', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '411001', city: 'Pune', state: 'Maharashtra', serviceable: true },
    { code: '411038', city: 'Pune', state: 'Maharashtra', serviceable: true },
    { code: '700001', city: 'Kolkata', state: 'West Bengal', serviceable: true },
    { code: '700091', city: 'Kolkata', state: 'West Bengal', serviceable: true },
  ];

  for (const p of pincodesData) {
    await prisma.pincode.upsert({
      where: { code: p.code },
      create: p,
      update: p,
    });
  }
  console.log('✓ Seeded Verified Serviceable Postal Codes');

  // ─────────────────────────────────────────────────────────────
  // 10. STUDENTS & MILESTONES
  // ─────────────────────────────────────────────────────────────
  const studentsData = [
    {
      id: 'STU-2026-001',
      name: 'Aarav Mehta',
      mobile: '9820123456',
      email: 'aarav.mehta@example.com',
      address: 'B-402 Horizon Heights, Worli Sea Face',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      courseCode: 'CAT-2026',
      centerCode: 'MUM-01',
      status: StudentStatus.ACTIVE,
      planIndex: 1, // 2-Stage
      milestones: [
        { num: 1, amount: 32500, paid: true },
        { num: 2, amount: 32500, paid: true },
      ],
    },
    {
      id: 'STU-2026-002',
      name: 'Ananya Sharma',
      mobile: '9811234567',
      email: 'ananya.sharma@example.com',
      address: 'House 14, Block C, Green Park Extension',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110016',
      courseCode: 'CAT-2026',
      centerCode: 'DEL-01',
      status: StudentStatus.ACTIVE,
      planIndex: 1, // 2-Stage
      milestones: [
        { num: 1, amount: 32500, paid: true },
        { num: 2, amount: 32500, paid: false },
      ],
    },
    {
      id: 'STU-2026-003',
      name: 'Rohan Kulkarni',
      mobile: '9765432109',
      email: 'rohan.kulkarni@example.com',
      address: '77 Prabhat Road, Lane 4, Deccan',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      courseCode: 'GMAT-FOC',
      centerCode: 'PUN-01',
      status: StudentStatus.ACTIVE,
      planIndex: 0, // Full
      milestones: [{ num: 1, amount: 48000, paid: true }],
    },
    {
      id: 'STU-2026-004',
      name: 'Sneha Iyer',
      mobile: '9900112233',
      email: 'sneha.iyer@example.com',
      address: '104 Palm Grove, 5th Block Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      courseCode: 'UPSC-2027',
      centerCode: 'BLR-01',
      status: StudentStatus.ACTIVE,
      planIndex: 2, // 4-Stage
      milestones: [
        { num: 1, amount: 21250, paid: true },
        { num: 2, amount: 21250, paid: false },
        { num: 3, amount: 21250, paid: false },
        { num: 4, amount: 21250, paid: false },
      ],
    },
    {
      id: 'STU-2026-005',
      name: 'Vikramaditya Das',
      mobile: '9830123987',
      email: 'vikram.das@example.com',
      address: '12/1 Gariahat Road, South City Enclave',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      courseCode: 'GATE-CS',
      centerCode: 'KOL-01',
      status: StudentStatus.ACTIVE,
      planIndex: 0, // Full
      milestones: [{ num: 1, amount: 38000, paid: true }],
    },
    {
      id: 'STU-2026-006',
      name: 'Pooja Patel',
      mobile: '9892011223',
      email: 'pooja.patel@example.com',
      address: 'Flat 12A, Orchid Towers, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      courseCode: 'CAT-2026',
      centerCode: 'MUM-01',
      status: StudentStatus.HOLD,
      planIndex: 1, // 2-Stage
      milestones: [
        { num: 1, amount: 32500, paid: false }, // Unpaid fee -> triggers payment hold
        { num: 2, amount: 32500, paid: false },
      ],
    },
    {
      id: 'STU-2026-007',
      name: 'Aditya Verma',
      mobile: '9810987654',
      email: 'aditya.verma@example.com',
      address: 'Flat 502, DLF Phase 2, MG Road',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      courseCode: 'UPSC-2027',
      centerCode: 'DEL-01',
      status: StudentStatus.ACTIVE,
      planIndex: 0, // Full
      milestones: [{ num: 1, amount: 85000, paid: true }],
    },
    {
      id: 'STU-2026-008',
      name: 'Kavita Nair',
      mobile: '9945123456',
      email: 'kavita.nair@example.com',
      address: 'A-22 Indiranagar, 100ft Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      courseCode: 'BANK-PO',
      centerCode: 'BLR-01',
      status: StudentStatus.ACTIVE,
      planIndex: 0, // Full
      milestones: [{ num: 1, amount: 24000, paid: true }],
    },
    {
      id: 'STU-2026-009',
      name: 'Rahul Deshmukh',
      mobile: '9764019283',
      email: 'rahul.deshmukh@example.com',
      address: 'Flat 301, Viman Nagar Residency',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411038',
      courseCode: 'CAT-2026',
      centerCode: 'PUN-01',
      status: StudentStatus.TRANSFERRED,
      planIndex: 0,
      milestones: [{ num: 1, amount: 65000, paid: true }],
    },
    {
      id: 'STU-2026-010',
      name: 'Neha Sengupta',
      mobile: '9831987654',
      email: 'neha.sengupta@example.com',
      address: 'Block BD-45, Salt Lake Sector 1',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700091',
      courseCode: 'GMAT-FOC',
      centerCode: 'KOL-01',
      status: StudentStatus.COMPLETED,
      planIndex: 0,
      milestones: [{ num: 1, amount: 48000, paid: true }],
    },
    {
      id: 'STU-2026-011',
      name: 'Farhan Khan',
      mobile: '9821876543',
      email: 'farhan.khan@example.com',
      address: 'Plot 88, Powai Lake Enclave, IIT Market',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400076',
      courseCode: 'GATE-CS',
      centerCode: 'MUM-01',
      status: StudentStatus.ACTIVE,
      planIndex: 0,
      milestones: [{ num: 1, amount: 38000, paid: true }],
    },
    {
      id: 'STU-2026-012',
      name: 'Divya Pillai',
      mobile: '9900987123',
      email: 'divya.pillai@example.com',
      address: 'Villa 18, Whitefield Prestige Oasis',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      courseCode: 'CAT-2026',
      centerCode: 'BLR-01',
      status: StudentStatus.ACTIVE,
      planIndex: 0,
      milestones: [{ num: 1, amount: 65000, paid: true }],
    },
  ];

  const students: Record<string, any> = {};
  for (const s of studentsData) {
    const studentRecord = await prisma.student.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        mobile: s.mobile,
        email: s.email,
        address: s.address,
        city: s.city,
        state: s.state,
        pincode: s.pincode,
        courseId: courses[s.courseCode].id,
        centerId: centers[s.centerCode].id,
        enrollmentDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        status: s.status,
        paymentPlanId: paymentPlans[s.planIndex].id,
      },
      update: {
        name: s.name,
        mobile: s.mobile,
        status: s.status,
      },
    });
    students[s.id] = studentRecord;

    for (const m of s.milestones) {
      await prisma.milestoneStatus.upsert({
        where: { studentId_milestoneNumber: { studentId: s.id, milestoneNumber: m.num } },
        create: {
          studentId: s.id,
          milestoneNumber: m.num,
          amount: m.amount,
          paid: m.paid,
          paidAt: m.paid ? new Date(Date.now() - (30 - m.num * 5) * 24 * 3600 * 1000) : null,
        },
        update: {
          amount: m.amount,
          paid: m.paid,
        },
      });
    }
  }
  console.log('✓ Seeded 12 Enrolled Students with Payment Milestones');

  // ─────────────────────────────────────────────────────────────
  // 11. DISPATCHES & DETAILED SHIPMENT TIMELINES
  // ─────────────────────────────────────────────────────────────
  const adminId = employees.SUPER_ADMIN.id;
  const blueDartId = couriers['Blue Dart Express'].id;
  const delhiveryId = couriers['Delhivery Surface & Express'].id;

  const dispatchesData = [
    {
      studentId: 'STU-2026-001',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.DELIVERED,
      courierPartnerId: blueDartId,
      awbNumber: 'BD-MUM-8921471',
      materialCost: 1530.0,
      dispatchedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      deliveredAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'PACKED', location: 'Mumbai Central Hub', reason: 'Kit packed with tamper-proof seal' },
        { status: 'HANDED_TO_COURIER', location: 'Mumbai Central Hub', reason: 'Handed over to Blue Dart logistics vehicle' },
        { status: 'IN_TRANSIT', location: 'Bhiwandi Sorting Facility', reason: 'Bag sorted and departed' },
        { status: 'OUT_FOR_DELIVERY', location: 'Worli Delivery Centre', reason: 'Out with delivery executive' },
        { status: 'DELIVERED', location: 'Worli, Mumbai', reason: 'Delivered to student Aarav Mehta' },
      ],
    },
    {
      studentId: 'STU-2026-002',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.IN_TRANSIT,
      courierPartnerId: delhiveryId,
      awbNumber: 'DLV-DEL-4512984',
      materialCost: 1530.0,
      dispatchedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'PACKED', location: 'Delhi NCR Hub', reason: 'Scanned at packing station 02' },
        { status: 'HANDED_TO_COURIER', location: 'Delhi NCR Hub', reason: 'Picked up by Delhivery agent' },
        { status: 'IN_TRANSIT', location: 'Gurugram Hub', reason: 'In transit to local delivery station' },
      ],
    },
    {
      studentId: 'STU-2026-003',
      kitName: 'GMAT Focus Complete Book Bundle',
      status: DispatchStatus.HANDED_TO_COURIER,
      courierPartnerId: blueDartId,
      awbNumber: 'BD-PUN-3310924',
      materialCost: 1150.0,
      dispatchedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'PACKED', location: 'Pune Regional Centre', reason: 'Packed and verified against BOM' },
        { status: 'HANDED_TO_COURIER', location: 'Pune Regional Centre', reason: 'Courier manifest signed' },
      ],
    },
    {
      studentId: 'STU-2026-004',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.PACKED,
      courierPartnerId: blueDartId,
      awbNumber: 'BD-BLR-1092837',
      materialCost: 1370.0,
      trackingEvents: [
        { status: 'PACKED', location: 'Bengaluru Hub', reason: 'Packed into heavy carton with barcode' },
      ],
    },
    {
      studentId: 'STU-2026-005',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.QUEUED,
      materialCost: 490.0,
      trackingEvents: [
        { status: 'QUEUED', location: 'Kolkata Depot', reason: 'Payment verified; waiting for batch packing' },
      ],
    },
    {
      studentId: 'STU-2026-006',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.HOLD,
      materialCost: 1530.0,
      trackingEvents: [
        { status: 'HOLD', location: 'Mumbai Central Hub', reason: 'Enrolment payment pending from Finance ERP' },
      ],
    },
    {
      studentId: 'STU-2026-007',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.DELIVERED,
      courierPartnerId: delhiveryId,
      awbNumber: 'DLV-DEL-9845123',
      materialCost: 1370.0,
      dispatchedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      deliveredAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'DELIVERED', location: 'New Delhi', reason: 'Received and signed by student' },
      ],
    },
    {
      studentId: 'STU-2026-008',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.FAILED_DELIVERY,
      courierPartnerId: blueDartId,
      awbNumber: 'BD-BLR-7762104',
      materialCost: 490.0,
      dispatchedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'IN_TRANSIT', location: 'Bengaluru Hub', reason: 'Dispatched to Indiranagar' },
        { status: 'OUT_FOR_DELIVERY', location: 'Indiranagar Hub', reason: 'Out with delivery agent' },
        { status: 'FAILED_DELIVERY', location: 'Bengaluru', reason: 'Door locked; candidate contact switched off' },
      ],
    },
    {
      studentId: 'STU-2026-011',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.OUT_FOR_DELIVERY,
      courierPartnerId: blueDartId,
      awbNumber: 'BD-MUM-9912048',
      materialCost: 490.0,
      dispatchedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'PACKED', location: 'Mumbai Hub', reason: 'Weight 2.5 kg confirmed' },
        { status: 'HANDED_TO_COURIER', location: 'Mumbai Hub', reason: 'Manifest verified' },
        { status: 'OUT_FOR_DELIVERY', location: 'Powai Hub', reason: 'Courier vehicle out for morning run' },
      ],
    },
    {
      studentId: 'STU-2026-012',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.IN_TRANSIT,
      courierPartnerId: blueDartId,
      awbNumber: 'BD-BLR-5541098',
      materialCost: 1530.0,
      dispatchedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      trackingEvents: [
        { status: 'PACKED', location: 'Bengaluru Hub', reason: 'Packed with bubble wrap' },
        { status: 'IN_TRANSIT', location: 'Whitefield Sorting Facility', reason: 'Vehicle dispatched' },
      ],
    },
  ];

  for (const d of dispatchesData) {
    const kit = kits[d.kitName];
    const existing = await prisma.dispatch.findFirst({
      where: { studentId: d.studentId, kitId: kit.id, enrollmentVersion: 1 },
    });

    let dispatchRecord;
    if (existing) {
      dispatchRecord = await prisma.dispatch.update({
        where: { id: existing.id },
        data: {
          status: d.status,
          awbNumber: d.awbNumber,
          materialCost: d.materialCost,
          courierPartnerId: d.courierPartnerId,
          dispatchedAt: d.dispatchedAt,
          deliveredAt: d.deliveredAt,
        },
      });
    } else {
      dispatchRecord = await prisma.dispatch.create({
        data: {
          studentId: d.studentId,
          kitId: kit.id,
          enrollmentVersion: 1,
          status: d.status,
          deliveryMode: DeliveryMode.COURIER,
          courierPartnerId: d.courierPartnerId,
          awbNumber: d.awbNumber,
          materialCost: d.materialCost,
          dispatchedAt: d.dispatchedAt,
          deliveredAt: d.deliveredAt,
          createdById: adminId,
        },
      });
    }

    if (d.trackingEvents && d.trackingEvents.length > 0) {
      for (let i = 0; i < d.trackingEvents.length; i++) {
        const ev = d.trackingEvents[i];
        const eventTime = new Date(Date.now() - (d.trackingEvents.length - i) * 12 * 3600 * 1000);
        await prisma.trackingEvent.create({
          data: {
            dispatchId: dispatchRecord.id,
            status: ev.status,
            location: ev.location,
            reason: ev.reason,
            timestamp: eventTime,
          },
        });
      }
    }

    // If failed delivery, create a realistic return record
    if (d.status === DispatchStatus.FAILED_DELIVERY) {
      await prisma.returnRecord.upsert({
        where: { dispatchId: dispatchRecord.id },
        create: {
          dispatchId: dispatchRecord.id,
          reason: 'Consignee door locked during 3 delivery attempts; telephone unreachable',
          condition: 'Original packaging undamaged',
          status: 'RTO_IN_TRANSIT',
        },
        update: {},
      });
    }
  }
  console.log('✓ Seeded 10 Dispatches with AWB Tracking Timelines and Return records');

  // ─────────────────────────────────────────────────────────────
  // 12. COURSE & CENTRE TRANSFERS
  // ─────────────────────────────────────────────────────────────
  const transferStudent = students['STU-2026-009'];
  if (transferStudent) {
    const existingTransfer = await prisma.transfer.findFirst({ where: { studentId: transferStudent.id } });
    if (!existingTransfer) {
      await prisma.transfer.create({
        data: {
          studentId: transferStudent.id,
          fromCenterId: centers['PUN-01'].id,
          toCenterId: centers['MUM-01'].id,
          fromCourseId: courses['CAT-2026'].id,
          toCourseId: courses['CAT-2026'].id,
          status: 'APPROVED',
          amountPaid: 65000.0,
          materialCost: 1530.0,
          usableCredit: 63470.0,
          targetFee: 65000.0,
          balance: 1530.0,
          reason: 'Student relocated for internship from Pune to Mumbai',
          resolution: 'Approved by Logistics Manager with material deduction',
          approvedById: employees.LOGISTICS_MANAGER.id,
        },
      });
    }
  }
  console.log('✓ Seeded Student Course/Centre Transfer & Reconciliation record');

  // ─────────────────────────────────────────────────────────────
  // 13. INTER-CENTRE ORDERS & PRINT REQUISITIONS
  // ─────────────────────────────────────────────────────────────
  const existingOrder = await prisma.centerOrder.findFirst();
  if (!existingOrder) {
    const order = await prisma.centerOrder.create({
      data: {
        fromCenterId: centers['MUM-01'].id,
        toCenterId: centers['PUN-01'].id,
        status: 'DISPATCHED',
        boxes: 4,
        awbNumber: 'BD-TRANSFER-8841',
        reason: 'Emergency restock for Pune batch starting next Monday',
        createdById: employees.LOGISTICS_MANAGER.id,
        lines: {
          create: [
            { itemId: items['BK-CAT-QA01'].id, quantity: 40 },
            { itemId: items['BK-CAT-DILR'].id, quantity: 30 },
          ],
        },
      },
    });
  }

  const existingReq = await prisma.printRequisition.findFirst();
  if (!existingReq) {
    await prisma.printRequisition.create({
      data: {
        vendor: 'Thomson Press India Ltd. (Navi Mumbai)',
        centerId: centers['MUM-01'].id,
        status: 'PARTIALLY_RECEIVED',
        createdById: employees.LOGISTICS_MANAGER.id,
        lines: {
          create: [
            { itemId: items['BK-CAT-QA01'].id, quantity: 500, receivedQuantity: 250, unitCost: 350.0 },
            { itemId: items['BK-CAT-VAR01'].id, quantity: 500, receivedQuantity: 500, unitCost: 320.0 },
          ],
        },
      },
    });
  }
  console.log('✓ Seeded Branch Stock Transfer Order & Vendor Print Requisitions');

  // ─────────────────────────────────────────────────────────────
  // 14. TEAM TASKS & OPERATIONS MESSAGES
  // ─────────────────────────────────────────────────────────────
  const tasksData = [
    {
      title: 'Audit Pune QA Vol 1 stock reconciliation',
      description: 'Physical audit report shows discrepancy of 3 units against system stock.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      assigneeId: employees.VIEWER_AUDITOR.id,
      creatorId: employees.LOGISTICS_MANAGER.id,
      reference: 'STOCK-PUN-01',
    },
    {
      title: 'Expedite Blue Dart pickup for batch MUM-2026-B',
      description: '14 cartons packed and labelled with barcode manifests.',
      priority: 'URGENT',
      status: 'TODO',
      assigneeId: employees.DISPATCH_EXECUTIVE.id,
      creatorId: employees.LOGISTICS_MANAGER.id,
      reference: 'MANIFEST-MUM-44',
    },
    {
      title: 'Inspect returned consignment for STU-2026-008',
      description: 'Check book seals and return to usable stock if undamaged.',
      priority: 'NORMAL',
      status: 'TODO',
      assigneeId: employees.WAREHOUSE_STAFF.id,
      creatorId: employees.DISPATCH_EXECUTIVE.id,
      reference: 'RET-BLR-008',
    },
  ];

  for (const t of tasksData) {
    const existing = await prisma.workTask.findFirst({ where: { title: t.title } });
    if (!existing) {
      await prisma.workTask.create({
        data: {
          ...t,
          dueAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
        },
      });
    }
  }

  const messagesData = [
    {
      senderId: employees.LOGISTICS_MANAGER.id,
      channel: 'operations',
      body: 'Good morning team. Blue Dart pickup is scheduled at 3:00 PM for the Mumbai Hub. Please ensure all CAT Pack 1 cartons are sealed and manifested.',
    },
    {
      senderId: employees.WAREHOUSE_STAFF.id,
      channel: 'operations',
      body: 'Mumbai station 01 has completed 28 kits. AWB numbers generated and synced to dispatch ledger.',
    },
    {
      senderId: employees.DISPATCH_EXECUTIVE.id,
      channel: 'operations',
      body: 'Verified address clearances for all 12 new enrolments. Only one student has an unserviceable postcode which is routed via Speed Post.',
    },
  ];

  for (const m of messagesData) {
    const existing = await prisma.teamMessage.findFirst({ where: { body: m.body } });
    if (!existing) {
      await prisma.teamMessage.create({ data: m });
    }
  }
  console.log('✓ Seeded Operational Tasks & Team Communications');

  // ─────────────────────────────────────────────────────────────
  // 15. NOTIFICATION TEMPLATES & SYSTEM SETTINGS
  // ─────────────────────────────────────────────────────────────
  const templates: Record<string, string> = {
    PACKED: 'Hi [Name], your [Course] [Kit] is packed and ready for dispatch.',
    HANDED_TO_COURIER: 'Your [Course] [Kit] is on its way. Courier: [Courier]. AWB: [AWB]. Estimated delivery: [Date].',
    OUT_FOR_DELIVERY: 'Hi [Name], your [Kit] is out for delivery today.',
    DELIVERED: 'Hi [Name], your [Course] [Kit] has been delivered.',
    FAILED_DELIVERY: 'Hi [Name], delivery of your [Kit] failed. Please contact your centre to confirm your address.',
    TRANSFER_CONFIRMED: 'Hi [Name], your transfer to [Course] is confirmed. Dispatch follows Finance clearance.',
  };
  for (const [event, content] of Object.entries(templates)) {
    await prisma.notificationTemplate.upsert({ where: { event }, create: { event, content }, update: {} });
  }

  for (const [key, value] of Object.entries({ forecastBufferPercent: 5, piiRetentionYears: 3, demoBootstrap: true })) {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  console.log('🎉 Comprehensive database seeding completed successfully!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
