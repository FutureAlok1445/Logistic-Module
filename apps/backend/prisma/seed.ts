import 'dotenv/config';
import { PrismaClient, EmployeeRole, StudentStatus, DispatchStatus, DeliveryMode } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive high-volume database seed (Last Week + This Week)...');

  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const hour = 3600 * 1000;

  const password = process.env.DEMO_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@12345678';
  const passwordHash = await bcrypt.hash(password, 10);

  // ─────────────────────────────────────────────────────────────
  // 1. EMPLOYEES & PROFILES (All 5 Roles)
  // ─────────────────────────────────────────────────────────────
  const employeesData = [
    {
      role: EmployeeRole.SUPER_ADMIN,
      email: (process.env.ADMIN_EMAIL || 'admin@demo.example').toLowerCase(),
      fullName: 'System Administrator',
      jobTitle: 'Head of Technology & Systems',
      phone: '+91 98200 11001',
      location: 'Mumbai Central Headquarters',
    },
    {
      role: EmployeeRole.LOGISTICS_MANAGER,
      email: 'manager@demo.example',
      fullName: 'Rajesh Sharma',
      jobTitle: 'National Logistics & Supply Chain Manager',
      phone: '+91 98200 11002',
      location: 'Mumbai Central Hub',
    },
    {
      role: EmployeeRole.DISPATCH_EXECUTIVE,
      email: 'dispatch@demo.example',
      fullName: 'Priya Nair',
      jobTitle: 'Lead Dispatch Operations Executive',
      phone: '+91 98200 11003',
      location: 'Delhi NCR Hub',
    },
    {
      role: EmployeeRole.WAREHOUSE_STAFF,
      email: 'warehouse@demo.example',
      fullName: 'Amit Verma',
      jobTitle: 'Warehouse Supervisor & Packing Lead',
      phone: '+91 98200 11004',
      location: 'Mumbai Central Hub',
    },
    {
      role: EmployeeRole.VIEWER_AUDITOR,
      email: 'viewer@demo.example',
      fullName: 'Sunita Rao',
      jobTitle: 'Senior Finance & Operations Auditor',
      phone: '+91 98200 11005',
      location: 'Bengaluru Regional Office',
    },
  ];

  const employees: Record<string, any> = {};
  for (const emp of employeesData) {
    employees[emp.role] = await prisma.employee.upsert({
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
    });
  }
  console.log('✓ Seeded 5 Employees with Profiles');

  // ─────────────────────────────────────────────────────────────
  // 2. REGIONAL CENTRES
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
  console.log('✓ Seeded 5 Courses with Centre Pricing');

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

  // ─────────────────────────────────────────────────────────────
  // 5. INVENTORY MATERIAL CATALOGUE
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
        data: { courseId: courses[k.courseCode].id, milestoneNumber: k.milestoneNumber, weightKg: k.weightKg },
      });
    } else {
      kitRecord = await prisma.kit.create({
        data: { name: k.name, courseId: courses[k.courseCode].id, milestoneNumber: k.milestoneNumber, weightKg: k.weightKg },
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

  // ─────────────────────────────────────────────────────────────
  // 7. STOCK BALANCES PER HUB
  // ─────────────────────────────────────────────────────────────
  const baseStock: Record<string, Record<string, number>> = {
    'MUM-01': { 'BK-CAT-QA01': 450, 'BK-CAT-VAR01': 380, 'BK-CAT-DILR': 410, 'BK-GMAT-OG': 220, 'BK-UPSC-GS1': 240, 'BK-UPSC-GS2': 260, 'BK-GATE-DS': 180, 'ST-BAG-ELMS': 520, 'ST-STAT-KIT': 750 },
    'DEL-01': { 'BK-CAT-QA01': 280, 'BK-CAT-VAR01': 240, 'BK-CAT-DILR': 220, 'BK-GMAT-OG': 140, 'BK-UPSC-GS1': 310, 'BK-UPSC-GS2': 290, 'BK-GATE-DS': 110, 'ST-BAG-ELMS': 340, 'ST-STAT-KIT': 450 },
    'BLR-01': { 'BK-CAT-QA01': 210, 'BK-CAT-VAR01': 190, 'BK-CAT-DILR': 195, 'BK-GMAT-OG': 160, 'BK-UPSC-GS1': 95, 'BK-UPSC-GS2': 85, 'BK-GATE-DS': 240, 'ST-BAG-ELMS': 260, 'ST-STAT-KIT': 310 },
    'PUN-01': { 'BK-CAT-QA01': 55, 'BK-CAT-VAR01': 42, 'BK-CAT-DILR': 14, 'BK-GMAT-OG': 28, 'BK-UPSC-GS1': 22, 'BK-UPSC-GS2': 18, 'BK-GATE-DS': 16, 'ST-BAG-ELMS': 65, 'ST-STAT-KIT': 95 },
    'KOL-01': { 'BK-CAT-QA01': 75, 'BK-CAT-VAR01': 68, 'BK-CAT-DILR': 55, 'BK-GMAT-OG': 24, 'BK-UPSC-GS1': 38, 'BK-UPSC-GS2': 40, 'BK-GATE-DS': 32, 'ST-BAG-ELMS': 85, 'ST-STAT-KIT': 110 },
  };

  for (const [centerCode, stockMap] of Object.entries(baseStock)) {
    const center = centers[centerCode];
    for (const [sku, qty] of Object.entries(stockMap)) {
      const item = items[sku];
      await prisma.stock.upsert({
        where: { itemId_centerId: { itemId: item.id, centerId: center.id } },
        create: { itemId: item.id, centerId: center.id, quantity: qty, damaged: sku === 'BK-CAT-QA01' ? 4 : 0 },
        update: { quantity: qty },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 8. COURIERS & ROUTING RULES
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
    couriers[c.name] = existing || (await prisma.courierPartner.create({ data: c }));
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

  // ─────────────────────────────────────────────────────────────
  // 9. SERVICEABLE PINCODES
  // ─────────────────────────────────────────────────────────────
  const pincodesData = [
    { code: '400001', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '400012', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '400028', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '400050', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '400076', city: 'Mumbai', state: 'Maharashtra', serviceable: true },
    { code: '110001', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '110016', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '110025', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '110048', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '110092', city: 'New Delhi', state: 'Delhi', serviceable: true },
    { code: '560001', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '560025', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '560034', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '560068', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '560100', city: 'Bengaluru', state: 'Karnataka', serviceable: true },
    { code: '411001', city: 'Pune', state: 'Maharashtra', serviceable: true },
    { code: '411014', city: 'Pune', state: 'Maharashtra', serviceable: true },
    { code: '411038', city: 'Pune', state: 'Maharashtra', serviceable: true },
    { code: '411057', city: 'Pune', state: 'Maharashtra', serviceable: true },
    { code: '700001', city: 'Kolkata', state: 'West Bengal', serviceable: true },
    { code: '700019', city: 'Kolkata', state: 'West Bengal', serviceable: true },
    { code: '700064', city: 'Kolkata', state: 'West Bengal', serviceable: true },
    { code: '700091', city: 'Kolkata', state: 'West Bengal', serviceable: true },
    { code: '500081', city: 'Hyderabad', state: 'Telangana', serviceable: true },
    { code: '600034', city: 'Chennai', state: 'Tamil Nadu', serviceable: true },
    { code: '380015', city: 'Ahmedabad', state: 'Gujarat', serviceable: true },
    { code: '302015', city: 'Jaipur', state: 'Rajasthan', serviceable: true },
    { code: '226010', city: 'Lucknow', state: 'Uttar Pradesh', serviceable: true },
    { code: '190001', city: 'Srinagar', state: 'Jammu and Kashmir', serviceable: false }, // Remote unserviceable
    { code: '795001', city: 'Imphal', state: 'Manipur', serviceable: false }, // Remote unserviceable
  ];

  for (const p of pincodesData) {
    await prisma.pincode.upsert({ where: { code: p.code }, create: p, update: p });
  }
  console.log(`✓ Seeded ${pincodesData.length} Pincodes across India (including unserviceable flags)`);

  // ─────────────────────────────────────────────────────────────
  // 10. REALISTIC STUDENTS POOL (36 Students Spread Over Time)
  // ─────────────────────────────────────────────────────────────
  const fullStudentsPool = [
    // --- LAST WEEK ENROLMENTS (14 to 8 days ago) ---
    { id: 'STU-2026-001', name: 'Aarav Mehta', mobile: '9820123456', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', address: 'B-402 Horizon Heights, Worli Sea Face', course: 'CAT-2026', center: 'MUM-01', daysAgo: 14, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: true },
    { id: 'STU-2026-002', name: 'Ananya Sharma', mobile: '9811234567', city: 'New Delhi', state: 'Delhi', pincode: '110016', address: 'House 14, Block C, Green Park Extension', course: 'CAT-2026', center: 'DEL-01', daysAgo: 13, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: false },
    { id: 'STU-2026-003', name: 'Rohan Kulkarni', mobile: '9765432109', city: 'Pune', state: 'Maharashtra', pincode: '411001', address: '77 Prabhat Road, Lane 4, Deccan Gymkhana', course: 'GMAT-FOC', center: 'PUN-01', daysAgo: 13, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-004', name: 'Sneha Iyer', mobile: '9900112233', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', address: '104 Palm Grove, 5th Block Koramangala', course: 'UPSC-2027', center: 'BLR-01', daysAgo: 12, status: StudentStatus.ACTIVE, plan: 2, paid1: true, paid2: true },
    { id: 'STU-2026-005', name: 'Vikramaditya Das', mobile: '9830123987', city: 'Kolkata', state: 'West Bengal', pincode: '700001', address: '12/1 Gariahat Road, South City Enclave', course: 'GATE-CS', center: 'KOL-01', daysAgo: 12, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-006', name: 'Pooja Patel', mobile: '9892011223', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', address: 'Flat 12A, Orchid Towers, Bandra West', course: 'CAT-2026', center: 'MUM-01', daysAgo: 11, status: StudentStatus.HOLD, plan: 1, paid1: false, paid2: false },
    { id: 'STU-2026-007', name: 'Aditya Verma', mobile: '9810987654', city: 'New Delhi', state: 'Delhi', pincode: '110001', address: 'Flat 502, DLF Phase 2, MG Road Enclave', course: 'UPSC-2027', center: 'DEL-01', daysAgo: 11, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-008', name: 'Kavita Nair', mobile: '9945123456', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', address: 'A-22 Indiranagar, 100ft Road Cross', course: 'BANK-PO', center: 'BLR-01', daysAgo: 10, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-009', name: 'Rahul Deshmukh', mobile: '9764019283', city: 'Pune', state: 'Maharashtra', pincode: '411038', address: 'Flat 301, Viman Nagar Residency', course: 'CAT-2026', center: 'PUN-01', daysAgo: 10, status: StudentStatus.TRANSFERRED, plan: 0, paid1: true },
    { id: 'STU-2026-010', name: 'Neha Sengupta', mobile: '9831987654', city: 'Kolkata', state: 'West Bengal', pincode: '700091', address: 'Block BD-45, Salt Lake Sector 1', course: 'GMAT-FOC', center: 'KOL-01', daysAgo: 9, status: StudentStatus.COMPLETED, plan: 0, paid1: true },
    { id: 'STU-2026-011', name: 'Farhan Khan', mobile: '9821876543', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', address: 'Plot 88, Powai Lake Enclave, IIT Market', course: 'GATE-CS', center: 'MUM-01', daysAgo: 9, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-012', name: 'Divya Pillai', mobile: '9900987123', city: 'Bengaluru', state: 'Karnataka', pincode: '560100', address: 'Villa 18, Electronic City Phase 1', course: 'CAT-2026', center: 'BLR-01', daysAgo: 8, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-013', name: 'Gaurav Aggarwal', mobile: '9811445566', city: 'New Delhi', state: 'Delhi', pincode: '110092', address: 'Pocket A-4, Mayur Vihar Phase 3', course: 'CAT-2026', center: 'DEL-01', daysAgo: 8, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: true },
    { id: 'STU-2026-014', name: 'Meera Nambiar', mobile: '9845332211', city: 'Bengaluru', state: 'Karnataka', pincode: '560025', address: '44 Richmond Town, Victoria Road', course: 'GMAT-FOC', center: 'BLR-01', daysAgo: 8, status: StudentStatus.ACTIVE, plan: 0, paid1: true },

    // --- THIS WEEK ENROLMENTS (7 to 2 days ago) ---
    { id: 'STU-2026-015', name: 'Siddharth Joshi', mobile: '9765223344', city: 'Pune', state: 'Maharashtra', pincode: '411014', address: 'B-701 Kalyani Nagar Waterfront', course: 'GATE-CS', center: 'PUN-01', daysAgo: 7, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-016', name: 'Ishita Banerjee', mobile: '9830554433', city: 'Kolkata', state: 'West Bengal', pincode: '700019', address: 'Flat 4B, Ballygunge Circular Road', course: 'UPSC-2027', center: 'KOL-01', daysAgo: 6, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: false },
    { id: 'STU-2026-017', name: 'Kunal Trivedi', mobile: '9820778899', city: 'Mumbai', state: 'Maharashtra', pincode: '400012', address: 'Tower 2, Lalbaug Parel Heights', course: 'BANK-PO', center: 'MUM-01', daysAgo: 6, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-018', name: 'Bhavna Chawla', mobile: '9811887766', city: 'New Delhi', state: 'Delhi', pincode: '110025', address: 'Plot 31, Friends Colony West', course: 'CAT-2026', center: 'DEL-01', daysAgo: 5, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: false },
    { id: 'STU-2026-019', name: 'Tarun Reddy', mobile: '9900448811', city: 'Bengaluru', state: 'Karnataka', pincode: '560068', address: '502 Green Glen Layout, Bellandur', course: 'UPSC-2027', center: 'BLR-01', daysAgo: 5, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-020', name: 'Ritu Khemka', mobile: '9831223399', city: 'Kolkata', state: 'West Bengal', pincode: '700064', address: 'GC Block, Sector 3, Salt Lake', course: 'CAT-2026', center: 'KOL-01', daysAgo: 4, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-021', name: 'Pranav Kulkarni', mobile: '9764551122', city: 'Pune', state: 'Maharashtra', pincode: '411057', address: 'Phase 1 Hinjewadi Tech Park Road', course: 'CAT-2026', center: 'PUN-01', daysAgo: 4, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: false },
    { id: 'STU-2026-022', name: 'Zoya Akhtar', mobile: '9820665544', city: 'Mumbai', state: 'Maharashtra', pincode: '400028', address: 'Shivaji Park Cross Road 2, Dadar', course: 'GMAT-FOC', center: 'MUM-01', daysAgo: 3, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-023', name: 'Nikhil Saxena', mobile: '9810332211', city: 'New Delhi', state: 'Delhi', pincode: '110048', address: 'Greater Kailash 1, M Block Market', course: 'GATE-CS', center: 'DEL-01', daysAgo: 3, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-024', name: 'Swati Hegde', mobile: '9945887711', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', address: '8th Main, 4th Block Jayanagar', course: 'CAT-2026', center: 'BLR-01', daysAgo: 2, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: false },

    // --- RECENT / TODAY ENROLMENTS (1 to 0 days ago) ---
    { id: 'STU-2026-025', name: 'Varun Singhania', mobile: '9821998877', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', address: 'Marine Lines Station Road, Fort', course: 'CAT-2026', center: 'MUM-01', daysAgo: 1, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-026', name: 'Deepika Rao', mobile: '9900119955', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', address: 'MG Road Trinity Circle Residency', course: 'UPSC-2027', center: 'BLR-01', daysAgo: 1, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-027', name: 'Manish Pandey', mobile: '9811554488', city: 'New Delhi', state: 'Delhi', pincode: '110016', address: 'Hauz Khas Village Road 12', course: 'GMAT-FOC', center: 'DEL-01', daysAgo: 1, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-028', name: 'Shruti Gokhale', mobile: '9765882233', city: 'Pune', state: 'Maharashtra', pincode: '411001', address: 'FC Road, Fergusson College Enclave', course: 'CAT-2026', center: 'PUN-01', daysAgo: 1, status: StudentStatus.ACTIVE, plan: 1, paid1: true, paid2: false },
    { id: 'STU-2026-029', name: 'Abhishek Roy', mobile: '9830441122', city: 'Kolkata', state: 'West Bengal', pincode: '700091', address: 'Sector 5 Electronics Complex', course: 'GATE-CS', center: 'KOL-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-030', name: 'Tanvi Shah', mobile: '9820551144', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', address: 'Pali Hill Bungalow Row 4', course: 'CAT-2026', center: 'MUM-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-031', name: 'Mohit Rawat', mobile: '9810112244', city: 'New Delhi', state: 'Delhi', pincode: '190001', address: 'Near Dal Gate, Boulevard Road', course: 'CAT-2026', center: 'DEL-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true }, // Unserviceable pincode
    { id: 'STU-2026-032', name: 'Ankita Sen', mobile: '9831776655', city: 'Kolkata', state: 'West Bengal', pincode: '700001', address: 'Park Street Flat 10', course: 'BANK-PO', center: 'KOL-01', daysAgo: 0, status: StudentStatus.HOLD, plan: 1, paid1: false, paid2: false }, // Payment hold
    { id: 'STU-2026-033', name: 'Akash Deshmukh', mobile: '9764119933', city: 'Pune', state: 'Maharashtra', pincode: '411038', address: 'Kothrud Stand Lane 8', course: 'GMAT-FOC', center: 'PUN-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-034', name: 'Pallavi Bhatt', mobile: '9820334488', city: 'Mumbai', state: 'Maharashtra', pincode: '400076', address: 'Hiranandani Gardens Powai', course: 'UPSC-2027', center: 'MUM-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
    { id: 'STU-2026-035', name: 'Harsh Vardhan', mobile: '9811663322', city: 'New Delhi', state: 'Delhi', pincode: '110001', address: 'Short', course: 'CAT-2026', center: 'DEL-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true }, // Short address flagged
    { id: 'STU-2026-036', name: 'Karthik Raja', mobile: '9900882244', city: 'Bengaluru', state: 'Karnataka', pincode: '560025', address: 'Lavelle Road Prestige Court', course: 'GATE-CS', center: 'BLR-01', daysAgo: 0, status: StudentStatus.ACTIVE, plan: 0, paid1: true },
  ];

  const students: Record<string, any> = {};
  for (const s of fullStudentsPool) {
    const studentRecord = await prisma.student.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        mobile: s.mobile,
        email: `${s.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        address: s.address,
        city: s.city,
        state: s.state,
        pincode: s.pincode,
        courseId: courses[s.course].id,
        centerId: centers[s.center].id,
        enrollmentDate: new Date(now - s.daysAgo * day),
        status: s.status,
        paymentPlanId: paymentPlans[s.plan].id,
      },
      update: { name: s.name, mobile: s.mobile, status: s.status, address: s.address, pincode: s.pincode },
    });
    students[s.id] = studentRecord;

    // Milestones
    await prisma.milestoneStatus.upsert({
      where: { studentId_milestoneNumber: { studentId: s.id, milestoneNumber: 1 } },
      create: {
        studentId: s.id,
        milestoneNumber: 1,
        amount: courses[s.course].fee / (s.plan === 0 ? 1 : s.plan === 1 ? 2 : 4),
        paid: s.paid1,
        paidAt: s.paid1 ? new Date(now - s.daysAgo * day) : null,
      },
      update: { paid: s.paid1 },
    });

    if (s.plan >= 1) {
      await prisma.milestoneStatus.upsert({
        where: { studentId_milestoneNumber: { studentId: s.id, milestoneNumber: 2 } },
        create: {
          studentId: s.id,
          milestoneNumber: 2,
          amount: courses[s.course].fee / (s.plan === 1 ? 2 : 4),
          paid: Boolean(s.paid2),
          paidAt: s.paid2 ? new Date(now - (s.daysAgo - 4) * day) : null,
        },
        update: { paid: Boolean(s.paid2) },
      });
    }
  }
  console.log(`✓ Seeded ${fullStudentsPool.length} Enrolled Students across Last Week & This Week`);

  // ─────────────────────────────────────────────────────────────
  // 11. HIGH-VOLUME DISPATCHES TIMELINE (30 Dispatches)
  // ─────────────────────────────────────────────────────────────
  const blueDartId = couriers['Blue Dart Express'].id;
  const delhiveryId = couriers['Delhivery Surface & Express'].id;
  const dtdcId = couriers['DTDC Courier Air Network'].id;
  const speedPostId = couriers['India Post Speed Post'].id;
  const adminId = employees.SUPER_ADMIN.id;

  const dispatchesTimeline = [
    // === LAST WEEK DISPATCHES (Delivered & Completed cycles: Day -14 to Day -8) ===
    {
      studentId: 'STU-2026-001',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.DELIVERED,
      courierId: blueDartId,
      awb: 'BD-MUM-8921471',
      cost: 1530.0,
      dispatchedDaysAgo: 13,
      deliveredDaysAgo: 9,
      events: [
        { status: 'PACKED', loc: 'Mumbai Central Hub', daysAgo: 13, reason: 'Packed with security seal' },
        { status: 'HANDED_TO_COURIER', loc: 'Mumbai Central Hub', daysAgo: 13, reason: 'Manifest signed by Blue Dart driver' },
        { status: 'IN_TRANSIT', loc: 'Bhiwandi Sorting Hub', daysAgo: 11, reason: 'Departed from main sorting facility' },
        { status: 'OUT_FOR_DELIVERY', loc: 'Worli Delivery Centre', daysAgo: 9, reason: 'Out with delivery agent' },
        { status: 'DELIVERED', loc: 'Worli, Mumbai', daysAgo: 9, reason: 'Delivered to student Aarav Mehta' },
      ],
    },
    {
      studentId: 'STU-2026-003',
      kitName: 'GMAT Focus Complete Book Bundle',
      status: DispatchStatus.DELIVERED,
      courierId: blueDartId,
      awb: 'BD-PUN-7718902',
      cost: 1150.0,
      dispatchedDaysAgo: 12,
      deliveredDaysAgo: 8,
      events: [
        { status: 'PACKED', loc: 'Pune Regional Centre', daysAgo: 12, reason: 'Packed into heavy carton' },
        { status: 'HANDED_TO_COURIER', loc: 'Pune Regional Centre', daysAgo: 12, reason: 'Courier pickup complete' },
        { status: 'OUT_FOR_DELIVERY', loc: 'Deccan Delivery Office', daysAgo: 8, reason: 'Out for morning delivery run' },
        { status: 'DELIVERED', loc: 'Pune', daysAgo: 8, reason: 'Signed by Rohan Kulkarni' },
      ],
    },
    {
      studentId: 'STU-2026-005',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.DELIVERED,
      courierId: delhiveryId,
      awb: 'DLV-KOL-6612984',
      cost: 490.0,
      dispatchedDaysAgo: 11,
      deliveredDaysAgo: 7,
      events: [
        { status: 'PACKED', loc: 'Kolkata Eastern Depot', daysAgo: 11, reason: 'Packed and verified against BOM' },
        { status: 'HANDED_TO_COURIER', loc: 'Kolkata Depot', daysAgo: 11, reason: 'Handed to Delhivery' },
        { status: 'IN_TRANSIT', loc: 'Howrah Hub', daysAgo: 9, reason: 'Bag departed' },
        { status: 'DELIVERED', loc: 'South City, Kolkata', daysAgo: 7, reason: 'Delivered successfully' },
      ],
    },
    {
      studentId: 'STU-2026-007',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.DELIVERED,
      courierId: delhiveryId,
      awb: 'DLV-DEL-9845123',
      cost: 1370.0,
      dispatchedDaysAgo: 10,
      deliveredDaysAgo: 7,
      events: [
        { status: 'PACKED', loc: 'Delhi NCR Hub', daysAgo: 10, reason: 'Packed with barcode label' },
        { status: 'HANDED_TO_COURIER', loc: 'Delhi NCR Hub', daysAgo: 10, reason: 'Handed to Delhivery logistics' },
        { status: 'DELIVERED', loc: 'New Delhi', daysAgo: 7, reason: 'Delivered to Aditya Verma' },
      ],
    },
    {
      studentId: 'STU-2026-008',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.FAILED_DELIVERY,
      courierId: blueDartId,
      awb: 'BD-BLR-7762104',
      cost: 490.0,
      dispatchedDaysAgo: 10,
      events: [
        { status: 'PACKED', loc: 'Bengaluru Hub', daysAgo: 10, reason: 'Packed and labelled' },
        { status: 'HANDED_TO_COURIER', loc: 'Bengaluru Hub', daysAgo: 10, reason: 'Dispatched with Blue Dart' },
        { status: 'OUT_FOR_DELIVERY', loc: 'Indiranagar Hub', daysAgo: 8, reason: 'Out with delivery agent' },
        { status: 'FAILED_DELIVERY', loc: 'Bengaluru', daysAgo: 8, reason: 'Door locked; candidate unreachable after 3 attempts' },
      ],
      returnReason: 'Consignee door locked during 3 delivery attempts; telephone unreachable',
    },
    {
      studentId: 'STU-2026-010',
      kitName: 'GMAT Focus Complete Book Bundle',
      status: DispatchStatus.DELIVERED,
      courierId: delhiveryId,
      awb: 'DLV-KOL-8841029',
      cost: 1150.0,
      dispatchedDaysAgo: 9,
      deliveredDaysAgo: 6,
      events: [
        { status: 'PACKED', loc: 'Kolkata Depot', daysAgo: 9, reason: 'Packed' },
        { status: 'DELIVERED', loc: 'Salt Lake, Kolkata', daysAgo: 6, reason: 'Delivered to Neha Sengupta' },
      ],
    },
    {
      studentId: 'STU-2026-013',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.DELIVERED,
      courierId: blueDartId,
      awb: 'BD-DEL-4412098',
      cost: 1530.0,
      dispatchedDaysAgo: 8,
      deliveredDaysAgo: 5,
      events: [
        { status: 'PACKED', loc: 'Delhi NCR Hub', daysAgo: 8, reason: 'Packed' },
        { status: 'DELIVERED', loc: 'Mayur Vihar, Delhi', daysAgo: 5, reason: 'Delivered' },
      ],
    },
    {
      studentId: 'STU-2026-014',
      kitName: 'GMAT Focus Complete Book Bundle',
      status: DispatchStatus.DELIVERED,
      courierId: blueDartId,
      awb: 'BD-BLR-3310492',
      cost: 1150.0,
      dispatchedDaysAgo: 8,
      deliveredDaysAgo: 5,
      events: [
        { status: 'PACKED', loc: 'Bengaluru Hub', daysAgo: 8, reason: 'Packed' },
        { status: 'DELIVERED', loc: 'Richmond Town, Bengaluru', daysAgo: 5, reason: 'Delivered' },
      ],
    },

    // === THIS WEEK DISPATCHES (In Transit, Out for Delivery, Handed over: Day -7 to Day -1) ===
    {
      studentId: 'STU-2026-002',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.IN_TRANSIT,
      courierId: delhiveryId,
      awb: 'DLV-DEL-4512984',
      cost: 1530.0,
      dispatchedDaysAgo: 5,
      events: [
        { status: 'PACKED', loc: 'Delhi NCR Hub', daysAgo: 5, reason: 'Scanned at packing station 02' },
        { status: 'HANDED_TO_COURIER', loc: 'Delhi NCR Hub', daysAgo: 5, reason: 'Picked up by Delhivery agent' },
        { status: 'IN_TRANSIT', loc: 'Gurugram Sorting Hub', daysAgo: 3, reason: 'In transit to local delivery hub' },
      ],
    },
    {
      studentId: 'STU-2026-004',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.IN_TRANSIT,
      courierId: blueDartId,
      awb: 'BD-BLR-1092837',
      cost: 1370.0,
      dispatchedDaysAgo: 4,
      events: [
        { status: 'PACKED', loc: 'Bengaluru Hub', daysAgo: 4, reason: 'Packed in reinforced box' },
        { status: 'HANDED_TO_COURIER', loc: 'Bengaluru Hub', daysAgo: 4, reason: 'Handed over' },
        { status: 'IN_TRANSIT', loc: 'Bengaluru South Sorting', daysAgo: 2, reason: 'Dispatched to Koramangala hub' },
      ],
    },
    {
      studentId: 'STU-2026-011',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.OUT_FOR_DELIVERY,
      courierId: blueDartId,
      awb: 'BD-MUM-9912048',
      cost: 490.0,
      dispatchedDaysAgo: 3,
      events: [
        { status: 'PACKED', loc: 'Mumbai Hub', daysAgo: 3, reason: 'Packed' },
        { status: 'HANDED_TO_COURIER', loc: 'Mumbai Hub', daysAgo: 3, reason: 'Handed to Blue Dart' },
        { status: 'IN_TRANSIT', loc: 'Kurla Hub', daysAgo: 2, reason: 'Departed' },
        { status: 'OUT_FOR_DELIVERY', loc: 'Powai Delivery Station', daysAgo: 0, reason: 'Out for delivery today with courier boy' },
      ],
    },
    {
      studentId: 'STU-2026-012',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.OUT_FOR_DELIVERY,
      courierId: blueDartId,
      awb: 'BD-BLR-5541098',
      cost: 1530.0,
      dispatchedDaysAgo: 3,
      events: [
        { status: 'PACKED', loc: 'Bengaluru Hub', daysAgo: 3, reason: 'Packed' },
        { status: 'HANDED_TO_COURIER', loc: 'Bengaluru Hub', daysAgo: 3, reason: 'Handed to Blue Dart' },
        { status: 'OUT_FOR_DELIVERY', loc: 'Electronic City Delivery Centre', daysAgo: 0, reason: 'Out for delivery to student' },
      ],
    },
    {
      studentId: 'STU-2026-015',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.IN_TRANSIT,
      courierId: blueDartId,
      awb: 'BD-PUN-8820194',
      cost: 490.0,
      dispatchedDaysAgo: 2,
      events: [
        { status: 'PACKED', loc: 'Pune Regional Centre', daysAgo: 2, reason: 'Packed' },
        { status: 'HANDED_TO_COURIER', loc: 'Pune Regional Centre', daysAgo: 2, reason: 'Courier pickup' },
        { status: 'IN_TRANSIT', loc: 'Hadapsar Facility', daysAgo: 1, reason: 'In transit' },
      ],
    },
    {
      studentId: 'STU-2026-016',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.IN_TRANSIT,
      courierId: delhiveryId,
      awb: 'DLV-KOL-1192834',
      cost: 1370.0,
      dispatchedDaysAgo: 2,
      events: [
        { status: 'PACKED', loc: 'Kolkata Depot', daysAgo: 2, reason: 'Packed' },
        { status: 'HANDED_TO_COURIER', loc: 'Kolkata Depot', daysAgo: 2, reason: 'Handed to Delhivery' },
      ],
    },
    {
      studentId: 'STU-2026-017',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.HANDED_TO_COURIER,
      courierId: blueDartId,
      awb: 'BD-MUM-7740192',
      cost: 490.0,
      dispatchedDaysAgo: 1,
      events: [
        { status: 'PACKED', loc: 'Mumbai Central Hub', daysAgo: 1, reason: 'Packed' },
        { status: 'HANDED_TO_COURIER', loc: 'Mumbai Central Hub', daysAgo: 1, reason: 'Manifest verified and handed over' },
      ],
    },
    {
      studentId: 'STU-2026-018',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.HANDED_TO_COURIER,
      courierId: delhiveryId,
      awb: 'DLV-DEL-3382910',
      cost: 1530.0,
      dispatchedDaysAgo: 1,
      events: [
        { status: 'PACKED', loc: 'Delhi NCR Hub', daysAgo: 1, reason: 'Packed' },
        { status: 'HANDED_TO_COURIER', loc: 'Delhi NCR Hub', daysAgo: 1, reason: 'Picked up by Delhivery van' },
      ],
    },
    {
      studentId: 'STU-2026-019',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.PACKED,
      courierId: blueDartId,
      awb: 'BD-BLR-9920145',
      cost: 1370.0,
      dispatchedDaysAgo: 1,
      events: [
        { status: 'PACKED', loc: 'Bengaluru South Hub', daysAgo: 1, reason: 'Packed and stacked in dispatch bay' },
      ],
    },
    {
      studentId: 'STU-2026-020',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.PACKED,
      courierId: delhiveryId,
      awb: 'DLV-KOL-5561029',
      cost: 1530.0,
      dispatchedDaysAgo: 1,
      events: [
        { status: 'PACKED', loc: 'Kolkata Depot', daysAgo: 1, reason: 'Packed with water-resistant wrap' },
      ],
    },
    {
      studentId: 'STU-2026-021',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.PACKED,
      courierId: blueDartId,
      awb: 'BD-PUN-1102948',
      cost: 1530.0,
      dispatchedDaysAgo: 1,
      events: [
        { status: 'PACKED', loc: 'Pune Regional Centre', daysAgo: 1, reason: 'Packed in Batch PUN-04' },
      ],
    },
    {
      studentId: 'STU-2026-022',
      kitName: 'GMAT Focus Complete Book Bundle',
      status: DispatchStatus.PACKED,
      courierId: blueDartId,
      awb: 'BD-MUM-2291039',
      cost: 1150.0,
      dispatchedDaysAgo: 1,
      events: [
        { status: 'PACKED', loc: 'Mumbai Central Hub', daysAgo: 1, reason: 'Station 01 packed' },
      ],
    },

    // === TODAY / FRESH DISPATCHES (Queued, Hold, Address Flagged: Today) ===
    {
      studentId: 'STU-2026-023',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.QUEUED,
      cost: 490.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'QUEUED', loc: 'Delhi NCR Hub', daysAgo: 0, reason: 'Payment milestone 1 verified; in packing queue' }],
    },
    {
      studentId: 'STU-2026-024',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.QUEUED,
      cost: 1530.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'QUEUED', loc: 'Bengaluru South Hub', daysAgo: 0, reason: 'Enrolment verified; in queue' }],
    },
    {
      studentId: 'STU-2026-025',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.QUEUED,
      cost: 1530.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'QUEUED', loc: 'Mumbai Central Hub', daysAgo: 0, reason: 'Admissions confirmed; queued for batch packing' }],
    },
    {
      studentId: 'STU-2026-026',
      kitName: 'UPSC Foundation Core Literature Set',
      status: DispatchStatus.QUEUED,
      cost: 1370.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'QUEUED', loc: 'Bengaluru Hub', daysAgo: 0, reason: 'Awaiting warehouse morning packing run' }],
    },
    {
      studentId: 'STU-2026-027',
      kitName: 'GMAT Focus Complete Book Bundle',
      status: DispatchStatus.QUEUED,
      cost: 1150.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'QUEUED', loc: 'Delhi NCR Hub', daysAgo: 0, reason: 'Queued for dispatch' }],
    },
    {
      studentId: 'STU-2026-028',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.QUEUED,
      cost: 1530.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'QUEUED', loc: 'Pune Regional Centre', daysAgo: 0, reason: 'Queued' }],
    },
    {
      studentId: 'STU-2026-006',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.HOLD,
      cost: 1530.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'HOLD', loc: 'Mumbai Central Hub', daysAgo: 0, reason: 'Enrolment fee payment pending in Finance ERP' }],
    },
    {
      studentId: 'STU-2026-032',
      kitName: 'GATE CS Core Theory & Problem Bank',
      status: DispatchStatus.HOLD,
      cost: 490.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'HOLD', loc: 'Kolkata Depot', daysAgo: 0, reason: 'Milestone 1 payment unconfirmed' }],
    },
    {
      studentId: 'STU-2026-031',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.ADDRESS_FLAGGED,
      cost: 1530.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'ADDRESS_FLAGGED', loc: 'Delhi NCR Hub', daysAgo: 0, reason: 'Pincode 190001 unserviceable by private courier; route via Speed Post' }],
    },
    {
      studentId: 'STU-2026-035',
      kitName: 'CAT 2026 Foundation Module (Pack 1)',
      status: DispatchStatus.ADDRESS_FLAGGED,
      cost: 1530.0,
      dispatchedDaysAgo: 0,
      events: [{ status: 'ADDRESS_FLAGGED', loc: 'Delhi NCR Hub', daysAgo: 0, reason: 'Address length under 8 characters; student contact required' }],
    },
  ];

  for (const d of dispatchesTimeline) {
    const kit = kits[d.kitName];
    const existing = await prisma.dispatch.findFirst({
      where: { studentId: d.studentId, kitId: kit.id, enrollmentVersion: 1 },
    });

    const createDate = new Date(now - d.dispatchedDaysAgo * day);
    const deliveredDate = d.deliveredDaysAgo !== undefined ? new Date(now - d.deliveredDaysAgo * day) : null;

    let dispatchRecord;
    if (existing) {
      dispatchRecord = await prisma.dispatch.update({
        where: { id: existing.id },
        data: {
          status: d.status,
          awbNumber: d.awb,
          materialCost: d.cost,
          courierPartnerId: d.courierId,
          dispatchedAt: createDate,
          deliveredAt: deliveredDate,
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
          courierPartnerId: d.courierId,
          awbNumber: d.awb,
          materialCost: d.cost,
          dispatchedAt: createDate,
          deliveredAt: deliveredDate,
          createdAt: createDate,
          createdById: adminId,
        },
      });
    }

    if (d.events && d.events.length > 0) {
      for (const ev of d.events) {
        await prisma.trackingEvent.create({
          data: {
            dispatchId: dispatchRecord.id,
            status: ev.status,
            location: ev.loc,
            reason: ev.reason,
            timestamp: new Date(now - ev.daysAgo * day),
          },
        });
      }
    }

    if (d.returnReason) {
      await prisma.returnRecord.upsert({
        where: { dispatchId: dispatchRecord.id },
        create: {
          dispatchId: dispatchRecord.id,
          reason: d.returnReason,
          condition: 'Original packaging undamaged',
          status: 'RTO_IN_TRANSIT',
          createdAt: new Date(now - 7 * day),
        },
        update: {},
      });
    }
  }
  console.log(`✓ Seeded ${dispatchesTimeline.length} Dispatches with Historical Timelines (Last Week + This Week)`);

  // ─────────────────────────────────────────────────────────────
  // 12. COURSE / CENTRE TRANSFERS & RECONCILIATIONS
  // ─────────────────────────────────────────────────────────────
  const transferRecords = [
    {
      studentId: 'STU-2026-009',
      fromCenter: 'PUN-01',
      toCenter: 'MUM-01',
      fromCourse: 'CAT-2026',
      toCourse: 'CAT-2026',
      status: 'APPROVED',
      amountPaid: 65000.0,
      materialCost: 1530.0,
      usableCredit: 63470.0,
      targetFee: 65000.0,
      balance: 1530.0,
      reason: 'Student relocated for internship from Pune to Mumbai',
      resolution: 'Approved by Logistics Manager with material deduction',
      approvedById: employees.LOGISTICS_MANAGER.id,
      daysAgo: 8,
    },
    {
      studentId: 'STU-2026-010',
      fromCenter: 'KOL-01',
      toCenter: 'KOL-01',
      fromCourse: 'GMAT-FOC',
      toCourse: 'CAT-2026',
      status: 'PENDING',
      amountPaid: 48000.0,
      materialCost: 1150.0,
      usableCredit: 46850.0,
      targetFee: 65000.0,
      balance: 18150.0,
      reason: 'Candidate switching preparation to CAT 2026 batch',
      resolution: null,
      approvedById: null,
      daysAgo: 2,
    },
  ];

  for (const tr of transferRecords) {
    const existing = await prisma.transfer.findFirst({ where: { studentId: tr.studentId } });
    if (!existing) {
      await prisma.transfer.create({
        data: {
          studentId: tr.studentId,
          fromCenterId: centers[tr.fromCenter].id,
          toCenterId: centers[tr.toCenter].id,
          fromCourseId: courses[tr.fromCourse].id,
          toCourseId: courses[tr.toCourse].id,
          status: tr.status,
          amountPaid: tr.amountPaid,
          materialCost: tr.materialCost,
          usableCredit: tr.usableCredit,
          targetFee: tr.targetFee,
          balance: tr.balance,
          reason: tr.reason,
          resolution: tr.resolution,
          approvedById: tr.approvedById,
          requestDate: new Date(now - tr.daysAgo * day),
        },
      });
    }
  }
  console.log('✓ Seeded Student Course & Centre Transfers (Historical + Active)');

  // ─────────────────────────────────────────────────────────────
  // 13. INTER-CENTRE ORDERS & VENDOR PRINT REQUISITIONS
  // ─────────────────────────────────────────────────────────────
  const branchOrders = [
    {
      fromCenter: 'MUM-01',
      toCenter: 'PUN-01',
      status: 'DELIVERED',
      boxes: 6,
      awb: 'BD-TRANSFER-8841',
      reason: 'Emergency restock for Pune CAT batch starting last Monday',
      lines: [
        { itemSku: 'BK-CAT-QA01', qty: 50 },
        { itemSku: 'BK-CAT-DILR', qty: 40 },
      ],
      daysAgo: 10,
    },
    {
      fromCenter: 'DEL-01',
      toCenter: 'KOL-01',
      status: 'IN_TRANSIT',
      boxes: 4,
      awb: 'DLV-TRANSFER-9102',
      reason: 'Inter-hub replenishment of UPSC Paper 1 manuals',
      lines: [
        { itemSku: 'BK-UPSC-GS1', qty: 40 },
        { itemSku: 'BK-UPSC-GS2', qty: 40 },
      ],
      daysAgo: 3,
    },
    {
      fromCenter: 'BLR-01',
      toCenter: 'PUN-01',
      status: 'REQUESTED',
      boxes: 2,
      awb: null,
      reason: 'Stock replenishment request for GMAT kits',
      lines: [{ itemSku: 'BK-GMAT-OG', qty: 30 }],
      daysAgo: 0,
    },
  ];

  for (const bo of branchOrders) {
    const existing = await prisma.centerOrder.findFirst({ where: { reason: bo.reason } });
    if (!existing) {
      await prisma.centerOrder.create({
        data: {
          fromCenterId: centers[bo.fromCenter].id,
          toCenterId: centers[bo.toCenter].id,
          status: bo.status,
          boxes: bo.boxes,
          awbNumber: bo.awb,
          reason: bo.reason,
          createdById: employees.LOGISTICS_MANAGER.id,
          createdAt: new Date(now - bo.daysAgo * day),
          lines: {
            create: bo.lines.map((l) => ({ itemId: items[l.itemSku].id, quantity: l.qty })),
          },
        },
      });
    }
  }

  const printRequisitions = [
    {
      vendor: 'Thomson Press India Ltd. (Navi Mumbai)',
      center: 'MUM-01',
      status: 'COMPLETED',
      daysAgo: 12,
      lines: [
        { itemSku: 'BK-CAT-QA01', qty: 1000, receivedQty: 1000, cost: 350.0 },
        { itemSku: 'BK-CAT-VAR01', qty: 1000, receivedQty: 1000, cost: 320.0 },
      ],
    },
    {
      vendor: 'Replika Press Pvt. Ltd. (Kundli, NCR)',
      center: 'DEL-01',
      status: 'PARTIALLY_RECEIVED',
      daysAgo: 4,
      lines: [
        { itemSku: 'BK-UPSC-GS1', qty: 600, receivedQty: 300, cost: 460.0 },
        { itemSku: 'BK-UPSC-GS2', qty: 600, receivedQty: 300, cost: 430.0 },
      ],
    },
    {
      vendor: 'Manipal Technologies Ltd.',
      center: 'BLR-01',
      status: 'ORDERED',
      daysAgo: 1,
      lines: [{ itemSku: 'BK-GATE-DS', qty: 500, receivedQty: 0, cost: 370.0 }],
    },
  ];

  for (const pr of printRequisitions) {
    const existing = await prisma.printRequisition.findFirst({ where: { vendor: pr.vendor, status: pr.status } });
    if (!existing) {
      await prisma.printRequisition.create({
        data: {
          vendor: pr.vendor,
          centerId: centers[pr.center].id,
          status: pr.status,
          createdById: employees.LOGISTICS_MANAGER.id,
          createdAt: new Date(now - pr.daysAgo * day),
          lines: {
            create: pr.lines.map((l) => ({
              itemId: items[l.itemSku].id,
              quantity: l.qty,
              receivedQuantity: l.receivedQty,
              unitCost: l.cost,
            })),
          },
        },
      });
    }
  }
  console.log('✓ Seeded Branch Stock Orders & Vendor Print Requisitions (Last Week + This Week)');

  // ─────────────────────────────────────────────────────────────
  // 14. OPERATIONAL TASKS & TEAM CONVERSATIONS
  // ─────────────────────────────────────────────────────────────
  const tasksData = [
    {
      title: 'Audit Mumbai QA Vol 1 stock inward receipt',
      description: 'Verify Thomson Press 1000 units delivery challan against physical counts.',
      priority: 'HIGH',
      status: 'DONE',
      assigneeId: employees.VIEWER_AUDITOR.id,
      creatorId: employees.LOGISTICS_MANAGER.id,
      reference: 'INWARD-MUM-01',
      daysAgo: 11,
    },
    {
      title: 'Resolve consignee phone for failed delivery STU-2026-008',
      description: 'Blue Dart reports candidate phone switched off. Coordinate with Bengaluru centre.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      assigneeId: employees.DISPATCH_EXECUTIVE.id,
      creatorId: employees.LOGISTICS_MANAGER.id,
      reference: 'RET-BLR-008',
      daysAgo: 6,
    },
    {
      title: 'Inspect returned consignment seal for RTO STU-2026-008',
      description: 'Check book seals and return to usable stock if undamaged upon arrival.',
      priority: 'NORMAL',
      status: 'TODO',
      assigneeId: employees.WAREHOUSE_STAFF.id,
      creatorId: employees.DISPATCH_EXECUTIVE.id,
      reference: 'RET-BLR-008',
      daysAgo: 3,
    },
    {
      title: 'Schedule Speed Post dispatch for remote Pincode 190001',
      description: 'Student Mohit Rawat is located in unserviceable valley zone. Manifest with India Post.',
      priority: 'HIGH',
      status: 'TODO',
      assigneeId: employees.DISPATCH_EXECUTIVE.id,
      creatorId: employees.LOGISTICS_MANAGER.id,
      reference: 'SP-DEL-01',
      daysAgo: 0,
    },
    {
      title: 'Batch pack 200 CAT Foundation kits for upcoming intake',
      description: 'Packing Station 01 & 02 allocated. Bags and material sets ready.',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
      assigneeId: employees.WAREHOUSE_STAFF.id,
      creatorId: employees.LOGISTICS_MANAGER.id,
      reference: 'BATCH-MUM-2026-B',
      daysAgo: 1,
    },
  ];

  for (const t of tasksData) {
    const existing = await prisma.workTask.findFirst({ where: { title: t.title } });
    if (!existing) {
      await prisma.workTask.create({
        data: {
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          assigneeId: t.assigneeId,
          creatorId: t.creatorId,
          reference: t.reference,
          createdAt: new Date(now - t.daysAgo * day),
          dueAt: new Date(now + 2 * day),
        },
      });
    }
  }

  const messagesData = [
    {
      senderId: employees.LOGISTICS_MANAGER.id,
      channel: 'operations',
      body: 'Last week Blue Dart pickups were 98.4% on-time across Mumbai and Bengaluru hubs. Good job team.',
      daysAgo: 7,
    },
    {
      senderId: employees.DISPATCH_EXECUTIVE.id,
      channel: 'operations',
      body: 'Delhivery Surface transit delays cleared at Gurugram hub. All CAT kits for North India are moving smoothly.',
      daysAgo: 4,
    },
    {
      senderId: employees.WAREHOUSE_STAFF.id,
      channel: 'operations',
      body: 'Completed packing 150 UPSC Foundation sets this morning. Barcode manifests generated for afternoon vehicle.',
      daysAgo: 1,
    },
    {
      senderId: employees.LOGISTICS_MANAGER.id,
      channel: 'operations',
      body: 'Attention team: Please verify serviceable pincodes before confirming Speed Post handovers today.',
      daysAgo: 0,
    },
  ];

  for (const m of messagesData) {
    const existing = await prisma.teamMessage.findFirst({ where: { body: m.body } });
    if (!existing) {
      await prisma.teamMessage.create({
        data: {
          senderId: m.senderId,
          channel: m.channel,
          body: m.body,
          createdAt: new Date(now - m.daysAgo * day),
        },
      });
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

  console.log('🎉 Comprehensive high-volume seed completed successfully!');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
