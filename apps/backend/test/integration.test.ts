import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app";
import { prisma } from "../src/config/database";
import { env } from "../src/config/env";
import type { FastifyInstance } from "fastify";
import { processNotifications } from "../src/modules/logistics/notifications.worker";
import * as XLSX from "xlsx";
import { zipSync, strToU8 } from "fflate";
import PDFDocument from "pdfkit";
let app: FastifyInstance;
const tokens: Record<string, string> = {};
const password = "IntegrationOnly!2026";
const origin = "http://localhost:3000";
let dispatchId = "";
let secondId = "";
let transferId = "";
let returnId = "";
let orderId = "";
let requisitionId = "";
async function api(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
  role = "SUPER_ADMIN",
  provider?: string,
) {
  return app.inject({
    method,
    url: `/api/v1${url}`,
    payload: payload as object,
    headers: {
      origin,
      ...(tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {}),
      ...(provider ? { "x-provider-key": provider } : {}),
    },
  });
}
const student = (id: string) => ({
  id,
  name: `Integration ${id}`,
  mobile: "9876543210",
  address: "12 College Road",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  courseId: "cat",
  centerId: "mumbai",
  enrollmentDate: "2026-10-01",
  status: "ACTIVE",
  paymentPlanId: "plan",
});
const payment = (id: string, paid: boolean) => ({
  studentId: id,
  milestoneNumber: 1,
  amount: "16000",
  paid,
});
before(async () => {
  app = await buildApp();
  const passwordHash = await bcrypt.hash(password, 12);
  for (const role of [
    "SUPER_ADMIN",
    "LOGISTICS_MANAGER",
    "DISPATCH_EXECUTIVE",
    "WAREHOUSE_STAFF",
    "VIEWER_AUDITOR",
  ] as const) {
    await prisma.employee.create({
      data: {
        id: role,
        email: `${role.toLowerCase()}@test.example`,
        fullName: role,
        role,
        passwordHash,
      },
    });
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: `${role.toLowerCase()}@test.example`, password },
    });
    assert.equal(r.statusCode, 200, r.body);
    tokens[role] = r.json().data.accessToken;
  }
  await prisma.center.createMany({
    data: [
      {
        id: "mumbai",
        name: "Mumbai",
        code: "MUM",
        city: "Mumbai",
        state: "Maharashtra",
      },
      {
        id: "delhi",
        name: "Delhi",
        code: "DEL",
        city: "Delhi",
        state: "Delhi",
      },
    ],
  });
  await prisma.course.createMany({
    data: [
      { id: "cat", name: "CAT", code: "CAT", fee: "40000" },
      { id: "gate", name: "GATE", code: "GATE", fee: "30000" },
    ],
  });
  await prisma.paymentPlan.create({
    data: { id: "plan", name: "Three milestones" },
  });
  await prisma.inventoryItem.create({
    data: {
      id: "book",
      sku: "BOOK",
      name: "Fundamentals",
      unitCost: "600",
      lowStockThreshold: 2,
    },
  });
  await prisma.courierPartner.create({
    data: { id: "courier", name: "Test courier" },
  });
  await prisma.courierRule.create({
    data: { courierPartnerId: "courier", state: "Maharashtra", priority: 1 },
  });
  await prisma.pincode.create({
    data: { code: "400001", city: "Mumbai", state: "Maharashtra" },
  });
  await prisma.kit.create({
    data: {
      id: "cat-a",
      name: "CAT A",
      courseId: "cat",
      milestoneNumber: 1,
      items: { create: { itemId: "book", quantity: 2 } },
    },
  });
  await prisma.kit.create({
    data: {
      id: "gate-a",
      name: "GATE A",
      courseId: "gate",
      milestoneNumber: 1,
      items: { create: { itemId: "book", quantity: 1 } },
    },
  });
  await prisma.notificationTemplate.create({
    data: { event: "PACKED", content: "Hi [Name], [Kit] packed." },
  });
});
after(async () => {
  await app.close();
  await prisma.$disconnect();
});
test("API rejects anonymous requests and cross-origin writes", async () => {
  assert.equal((await app.inject("/api/v1/students")).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        headers: { origin: "https://attacker.example" },
        payload: { email: "x@test.example", password: "x" },
      })
    ).statusCode,
    403,
  );
});
test("role boundaries are enforced on server", async () => {
  assert.equal(
    (await api("GET", "/students", undefined, "WAREHOUSE_STAFF")).statusCode,
    403,
  );
  assert.equal(
    (
      await api(
        "POST",
        "/employees",
        { email: "x@test.example" },
        "LOGISTICS_MANAGER",
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await api(
        "POST",
        "/inventory/adjust",
        {
          itemId: "book",
          centerId: "mumbai",
          quantity: 1,
          reason: "Test receipt",
        },
        "VIEWER_AUDITOR",
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await api("GET", "/inventory", undefined, "VIEWER_AUDITOR")).statusCode,
    200,
  );
});
test("only scoped provider can ingest student identity", async () => {
  const body = { eventId: "admission-1", rows: [student("s1"), student("s2")] };
  assert.equal(
    (await api("POST", "/integrations/students", body, "SUPER_ADMIN", "wrong"))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await api(
        "POST",
        "/integrations/students",
        body,
        "SUPER_ADMIN",
        env.ADMISSIONS_API_KEY,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await api(
        "POST",
        "/integrations/students",
        body,
        "SUPER_ADMIN",
        env.ADMISSIONS_API_KEY,
      )
    ).json().data.duplicate,
    true,
  );
  assert.equal(await prisma.student.count(), 2);
  assert.equal(
    (await api("POST", "/students", { ...student("s1"), status: "ACTIVE" }))
      .statusCode,
    404,
  );
});
test("payment queue is idempotent and pending milestones do not unlock kits", async () => {
  const pending = await api(
    "POST",
    "/integrations/payments",
    { eventId: "payment-pending", rows: [payment("s1", false)] },
    "SUPER_ADMIN",
    env.FINANCE_API_KEY,
  );
  assert.equal(pending.statusCode, 200, pending.body);
  assert.equal(await prisma.dispatch.count(), 0);
  const paid = await api(
    "POST",
    "/integrations/payments",
    {
      eventId: "payment-cleared",
      rows: [payment("s1", true), payment("s2", true)],
    },
    "SUPER_ADMIN",
    env.FINANCE_API_KEY,
  );
  assert.equal(paid.statusCode, 200, paid.body);
  assert.equal(await prisma.dispatch.count(), 2);
  await api("POST", "/queue/reconcile", {});
  assert.equal(await prisma.dispatch.count(), 2);
  dispatchId = (
    await prisma.dispatch.findFirstOrThrow({ where: { studentId: "s1" } })
  ).id;
  secondId = (
    await prisma.dispatch.findFirstOrThrow({ where: { studentId: "s2" } })
  ).id;
});
test("atomic bulk packing rolls back every shipment when stock is insufficient", async () => {
  assert.equal(
    (
      await api("POST", "/inventory/adjust", {
        itemId: "book",
        centerId: "mumbai",
        quantity: 3,
        reason: "Vendor inward",
      })
    ).statusCode,
    200,
  );
  const response = await api("POST", "/dispatches/transition", {
    ids: [dispatchId, secondId],
    status: "PACKED",
    warehouseId: "mumbai",
  });
  assert.equal(response.statusCode, 422, response.body);
  assert.equal(await prisma.dispatch.count({ where: { status: "PACKED" } }), 0);
  assert.equal((await prisma.stock.findFirstOrThrow()).quantity, 3);
  assert.equal(await prisma.notificationLog.count(), 0);
});
test("negative inventory is rejected and ledger is append only", async () => {
  assert.equal(
    (
      await api("POST", "/inventory/adjust", {
        itemId: "book",
        centerId: "mumbai",
        quantity: -4,
        reason: "Adjustment test",
      })
    ).statusCode,
    422,
  );
  const movement = await prisma.stockMovement.findFirstOrThrow();
  await assert.rejects(
    prisma.stockMovement.update({
      where: { id: movement.id },
      data: { reason: "rewrite" },
    }),
  );
  const audit = await prisma.auditLog.findFirstOrThrow();
  await assert.rejects(prisma.auditLog.delete({ where: { id: audit.id } }));
});
test("payment revocation immediately holds queued shipment and blocks packing", async () => {
  await api(
    "POST",
    "/integrations/payments",
    { eventId: "revocation", rows: [payment("s1", false)] },
    "SUPER_ADMIN",
    env.FINANCE_API_KEY,
  );
  assert.equal(
    (await prisma.dispatch.findUniqueOrThrow({ where: { id: dispatchId } }))
      .status,
    "HOLD",
  );
  assert.equal(
    (
      await api("POST", "/dispatches/transition", {
        ids: [dispatchId],
        status: "PACKED",
        warehouseId: "mumbai",
      })
    ).statusCode,
    422,
  );
  assert.equal((await prisma.stock.findFirstOrThrow()).quantity, 3);
  await api(
    "POST",
    "/integrations/payments",
    { eventId: "reclear", rows: [payment("s1", true)] },
    "SUPER_ADMIN",
    env.FINANCE_API_KEY,
  );
});
test("packing commits exact cost, stock snapshot, audit and transactional notification", async () => {
  const r = await api("POST", "/dispatches/transition", {
    ids: [dispatchId],
    status: "PACKED",
    warehouseId: "mumbai",
  });
  assert.equal(r.statusCode, 200, r.body);
  const d = await prisma.dispatch.findUniqueOrThrow({
    where: { id: dispatchId },
  });
  assert.equal(d.materialCost.toString(), "1200");
  assert.ok(d.addressSnapshot);
  assert.equal((await prisma.stock.findFirstOrThrow()).quantity, 1);
  assert.equal(await prisma.notificationLog.count(), 1);
  assert.equal(
    (
      await api("POST", "/dispatches/transition", {
        ids: [dispatchId],
        status: "PACKED",
        warehouseId: "mumbai",
      })
    ).statusCode,
    422,
  );
});
test("courier handover needs manager approval, AWB and override reason", async () => {
  const stockBefore = await prisma.stock.findFirstOrThrow({
    where: { itemId: "book", centerId: "mumbai" },
  });
  assert.equal(
    (
      await api("POST", "/dispatches/transition", {
        ids: [dispatchId],
        status: "HOLD",
        reason: "Packing inspection hold",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await api("POST", "/dispatches/transition", {
        ids: [dispatchId],
        status: "PACKED",
        warehouseId: "mumbai",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await prisma.stock.findFirstOrThrow({
        where: { itemId: "book", centerId: "mumbai" },
      })
    ).quantity,
    stockBefore.quantity,
  );
  const body = {
    ids: [dispatchId],
    status: "HANDED_TO_COURIER",
    awbNumber: "TEST-AWB",
  };
  assert.equal(
    (await api("POST", "/dispatches/transition", body, "DISPATCH_EXECUTIVE"))
      .statusCode,
    422,
  );
  assert.equal(
    (
      await api("POST", "/dispatches/transition", {
        ...body,
        awbNumber: undefined,
      })
    ).statusCode,
    422,
  );
  const r = await api("POST", "/dispatches/transition", body);
  assert.equal(r.statusCode, 200, r.body);
});
test("outbox never pretends unconfigured messages were sent", async () => {
  const target = await prisma.notificationLog.findFirstOrThrow({
    where: { status: "PENDING" },
  });
  await prisma.notificationLog.update({
    where: { id: target.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await processNotifications();
  const n = await prisma.notificationLog.findUniqueOrThrow({
    where: { id: target.id },
  });
  assert.equal(n.status, "WAITING_CONFIGURATION");
  assert.equal(n.sentAt, null);
});
test("transfer snapshot subtracts shipped costs and waits for authoritative sync", async () => {
  const r = await api("POST", "/transfers", {
    studentId: "s1",
    toCourseId: "gate",
    toCenterId: "delhi",
    reason: "Student course change",
  });
  assert.equal(r.statusCode, 200, r.body);
  transferId = r.json().data.id;
  assert.equal(r.json().data.usableCredit, "14800");
  assert.equal(r.json().data.balance, "15200");
  const approval = await api("POST", `/transfers/${transferId}/resolve`, {
    approved: true,
    resolution: "DEDUCT_MATERIAL_COST",
    reason: "Management policy approved",
  });
  assert.equal(approval.statusCode, 200, approval.body);
  assert.equal(
    (await prisma.student.findUniqueOrThrow({ where: { id: "s1" } })).courseId,
    "cat",
  );
  assert.equal(
    (
      await api(
        "POST",
        "/integrations/students",
        {
          eventId: "transfer-sync",
          rows: [{ ...student("s1"), courseId: "gate", centerId: "delhi" }],
        },
        "SUPER_ADMIN",
        env.ADMISSIONS_API_KEY,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    await prisma.milestoneStatus.count({ where: { studentId: "s1" } }),
    0,
  );
  assert.equal(
    (await prisma.transfer.findUniqueOrThrow({ where: { id: transferId } }))
      .status,
    "COMPLETED",
  );
});
test("return condition reconciles packed snapshot once", async () => {
  await api("POST", "/dispatches/transition", {
    ids: [dispatchId],
    status: "FAILED_DELIVERY",
    reason: "Recipient unavailable",
  });
  const r = await api("POST", "/returns", {
    dispatchId,
    reason: "Failed delivery RTO",
  });
  assert.equal(r.statusCode, 200, r.body);
  returnId = r.json().data.id;
  await api("POST", "/dispatches/transition", {
    ids: [dispatchId],
    status: "RTO_INITIATED",
    reason: "Return to warehouse",
  });
  const received = await api("POST", `/returns/${returnId}/receive`, {
    condition: "UNUSABLE",
  });
  assert.equal(received.statusCode, 200, received.body);
  const stock = await prisma.stock.findFirstOrThrow({
    where: { centerId: "mumbai" },
  });
  assert.equal(stock.quantity, 1);
  assert.equal(stock.damaged, 2);
  assert.equal(
    (
      await api("POST", `/returns/${returnId}/receive`, {
        condition: "UNUSABLE",
      })
    ).statusCode,
    422,
  );
});
test("centre order moves goods only on dispatch and reconciles shortage once", async () => {
  await api("POST", "/inventory/adjust", {
    itemId: "book",
    centerId: "mumbai",
    quantity: 10,
    reason: "Vendor replenishment",
  });
  const r = await api("POST", "/orders", {
    fromCenterId: "mumbai",
    toCenterId: "delhi",
    reason: "Regional batch request",
    boxes: 2,
    lines: [{ itemId: "book", quantity: 5 }],
  });
  assert.equal(r.statusCode, 200, r.body);
  orderId = r.json().data.id;
  assert.equal(
    (await api("POST", `/orders/${orderId}/dispatch`, { awbNumber: "ORDER-1" }))
      .statusCode,
    200,
  );
  const inward = await api("POST", `/orders/${orderId}/receive`, {
    lines: [{ itemId: "book", quantity: 3, damaged: 1 }],
  });
  assert.equal(inward.statusCode, 200, inward.body);
  assert.equal(inward.json().data.status, "DISCREPANCY");
  assert.equal(
    (await prisma.stock.findFirstOrThrow({ where: { centerId: "delhi" } }))
      .quantity,
    3,
  );
  assert.equal(
    (
      await api("POST", `/orders/${orderId}/receive`, {
        lines: [{ itemId: "book", quantity: 3, damaged: 1 }],
      })
    ).statusCode,
    422,
  );
});
test("vendor receipts cannot exceed ordered quantity", async () => {
  const r = await api("POST", "/requisitions", {
    centerId: "mumbai",
    vendor: "Test vendor",
    lines: [{ itemId: "book", quantity: 3 }],
  });
  assert.equal(r.statusCode, 200, r.body);
  requisitionId = r.json().data.id;
  assert.equal(
    (
      await api("POST", `/requisitions/${requisitionId}/receive`, {
        lines: [{ itemId: "book", quantity: 4 }],
      })
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await api("POST", `/requisitions/${requisitionId}/receive`, {
        lines: [{ itemId: "book", quantity: 3 }],
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await api("POST", `/requisitions/${requisitionId}/receive`, {
        lines: [{ itemId: "book", quantity: 1 }],
      })
    ).statusCode,
    422,
  );
});
test("reports export actual data in CSV, XLSX and PDF without general contact PII", async () => {
  for (const format of ["csv", "xlsx", "pdf"]) {
    const r = await api("GET", `/reports/dispatch?format=${format}`);
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.rawPayload.length > 100);
    if (format === "csv") assert.ok(!r.body.includes("9876543210"));
  }
  assert.equal(
    (
      await api(
        "GET",
        "/reports/labels?format=pdf",
        undefined,
        "VIEWER_AUDITOR",
      )
    ).statusCode,
    403,
  );
  assert.equal((await api("GET", "/dashboard")).statusCode, 200);
  const shipment = await prisma.dispatch.findUniqueOrThrow({
    where: { id: dispatchId },
  });
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { createdAt: new Date("2020-01-01T00:00:00Z") },
  });
  const costReport = await api(
    "GET",
    "/reports/cost?from=2026-01-01&format=csv",
  );
  assert.equal(costReport.statusCode, 200, costReport.body);
  assert.ok(
    costReport.body.includes("1200"),
    "Material costs use dispatch date rather than queue creation date",
  );
  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { createdAt: shipment.createdAt },
  });
});
test("employee profile cannot escalate role and team messages preserve private conversations", async () => {
  const original = await api(
    "GET",
    "/profile",
    undefined,
    "DISPATCH_EXECUTIVE",
  );
  const m = original.json().data;
  const saved = await api(
    "PUT",
    "/profile",
    {
      fullName: "Dispatch Operator",
      jobTitle: "Packing desk",
      availability: "BUSY",
      statusMessage: "Packing morning run",
      role: "SUPER_ADMIN",
    },
    "DISPATCH_EXECUTIVE",
  );
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().data.role, "DISPATCH_EXECUTIVE");
  assert.equal(saved.json().data.profile.availability, "BUSY");
  const team = (await api("GET", "/team")).json().data;
  const manager = team.find(
    (x: { role: string }) => x.role === "LOGISTICS_MANAGER",
  );
  const message = await api(
    "POST",
    "/messages",
    { recipientId: manager.id, body: "Private packing handover" },
    "DISPATCH_EXECUTIVE",
  );
  assert.equal(message.statusCode, 200, message.body);
  const own = (
    await api(
      "GET",
      `/messages?recipientId=${manager.id}`,
      undefined,
      "DISPATCH_EXECUTIVE",
    )
  ).json().data;
  assert.equal(own.length, 1);
  const unrelated = (
    await api("GET", `/messages?recipientId=${manager.id}`)
  ).json().data;
  assert.equal(unrelated.length, 0);
  assert.equal(
    (
      await api(
        "POST",
        "/messages",
        { channel: "announcements", body: "Not authorised" },
        "DISPATCH_EXECUTIVE",
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await api("GET", "/profile", undefined, "WAREHOUSE_STAFF")).statusCode,
    200,
  );
  assert.equal(
    (await prisma.employee.findUniqueOrThrow({ where: { id: m.id } })).role,
    "DISPATCH_EXECUTIVE",
  );
});
test("task assignment and task updates require appropriate owner permissions", async () => {
  const team = (await api("GET", "/team")).json().data;
  const warehouse = team.find(
    (x: { role: string }) => x.role === "WAREHOUSE_STAFF",
  );
  const task = await api("POST", "/tasks", {
    title: "Verify vendor inward",
    assigneeId: warehouse.id,
    priority: "HIGH",
  });
  assert.equal(task.statusCode, 200, task.body);
  const id = task.json().data.id;
  assert.equal(
    (
      await api(
        "PATCH",
        `/tasks/${id}`,
        { status: "DONE" },
        "DISPATCH_EXECUTIVE",
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await api(
        "PATCH",
        `/tasks/${id}`,
        { status: "IN_PROGRESS" },
        "WAREHOUSE_STAFF",
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (await api("GET", "/tasks", undefined, "DISPATCH_EXECUTIVE")).json().data
      .length,
    0,
  );
  assert.equal(
    (
      await api(
        "POST",
        "/tasks",
        { title: "Not authorised", assigneeId: warehouse.id },
        "VIEWER_AUDITOR",
      )
    ).statusCode,
    403,
  );
});
test("workbook analysis is private, persistent and never mutates upstream data", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Course", "Center", "Amount"],
      ["CAT", "Mumbai", "₹1,200"],
      ["GATE", "Delhi", "2500"],
    ]),
    "IMS dispatch",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Material", "Stock"],
      ["Book", 12],
    ]),
    "Stock",
  );
  const beforeCount = await prisma.student.count();
  const upload = await previewFile(
    "ims.xlsx",
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
    "/workbooks",
  );
  assert.equal(upload.statusCode, 200, upload.body);
  const data = upload.json().data;
  assert.equal(data.sheets[0].name, "IMS dispatch");
  assert.equal(data.sheets.length, 2);
  assert.equal(await prisma.student.count(), beforeCount);
  assert.equal(
    (await api("GET", `/workbooks/${data.id}`, undefined, "LOGISTICS_MANAGER"))
      .statusCode,
    404,
  );
  const saved = await api("PATCH", `/workbooks/${data.id}`, {
    name: "IMS reviewed workbook",
    view: {
      sheet: 0,
      header: 0,
      group: "Course",
      measure: "Amount",
      hidden: [],
    },
  });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(
    (await api("GET", `/workbooks/${data.id}`)).json().data.view.group,
    "Course",
  );
  assert.equal(
    (await api("GET", `/workbooks/${data.id}/export`)).statusCode,
    200,
  );
  assert.equal(
    (await api("GET", "/workbooks", undefined, "WAREHOUSE_STAFF")).statusCode,
    403,
  );
  assert.equal(
    (
      await api(
        "DELETE",
        `/workbooks/${data.id}`,
        undefined,
        "LOGISTICS_MANAGER",
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (await api("GET", "/workbook-templates/students")).statusCode,
    200,
  );
});
test("text sources require review and remain private analytical workbooks", async () => {
  const before = await prisma.student.count();
  const response = await api("POST", "/workbooks/from-text", {
    name: "Reviewed IMS notes",
    text: "City: Mumbai; Amount: 1200\n\nCity: Delhi; Amount: 2500",
    mode: "keyvalue",
  });
  assert.equal(response.statusCode, 200, response.body);
  const book = response.json().data;
  assert.equal(book.rowCount, 2);
  assert.deepEqual(book.sheets[0].rows[0], ["City", "Amount"]);
  assert.equal(
    (await api("GET", `/workbooks/${book.id}`, undefined, "VIEWER_AUDITOR"))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await api("POST", "/workbooks/from-text", {
        name: "Ambiguous",
        text: "Prose without keys",
        mode: "keyvalue",
      })
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await api(
        "POST",
        "/workbooks/from-text",
        { name: "Unauthorized", text: "A,B\n1,2", mode: "delimited" },
        "VIEWER_AUDITOR",
      )
    ).statusCode,
    403,
  );
  assert.equal(await prisma.student.count(), before);
  const word = Buffer.from(
    zipSync({
      "word/document.xml": strToU8(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Dispatch note for review</w:t></w:r></w:p><w:p><w:r><w:t>Warehouse status pending</w:t></w:r></w:p></w:body></w:document>',
      ),
    }),
  );
  const extracted = await previewFile(
    "notes.docx",
    word,
    "/workbooks/extract-text",
  );
  assert.equal(extracted.statusCode, 200, extracted.body);
  assert.ok(extracted.json().data.text.includes("Dispatch note for review"));
});
test("notification inbox only includes the employee's tasks and eligible conversations", async () => {
  const result = await api("GET", "/inbox", undefined, "DISPATCH_EXECUTIVE");
  assert.equal(result.statusCode, 200, result.body);
  const unrelated = await api("GET", "/inbox");
  assert.ok(!unrelated.body.includes("Private packing handover"));
  const manager = await api("GET", "/inbox", undefined, "LOGISTICS_MANAGER");
  assert.ok(manager.body.includes("Private packing handover"));
  assert.ok(
    !result.json().data.some((item: { kind: string }) => item.kind === "task"),
  );
  const warehouse = await api("GET", "/inbox", undefined, "WAREHOUSE_STAFF");
  assert.equal(warehouse.statusCode, 200, warehouse.body);
  assert.ok(
    warehouse
      .json()
      .data.some((item: { kind: string }) => item.kind === "task"),
  );
});
test("cross-page selection validates permissions and bounded count", async () => {
  const packing = await api(
    "GET",
    "/warehouse-packing",
    undefined,
    "WAREHOUSE_STAFF",
  );
  assert.equal(packing.statusCode, 200, packing.body);
  assert.ok(!packing.body.includes("9876543210"));
  assert.ok(!packing.body.includes("12 College Road"));
  assert.equal(
    (await api("GET", "/exceptions", undefined, "WAREHOUSE_STAFF")).statusCode,
    403,
  );
  assert.equal(
    (await api("GET", "/dispatches?status=invalid")).statusCode,
    400,
  );
  assert.equal(
    (await api("GET", "/reports/inventory?from=&to=")).statusCode,
    200,
  );
  const r = await api("GET", "/dispatches/select?count=500");
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(r.json().data.ids.length <= 500);
  assert.equal(
    (await api("GET", "/dispatches/select?count=1001")).statusCode,
    400,
  );
  assert.equal(
    (
      await api(
        "GET",
        "/dispatches/select?count=100",
        undefined,
        "VIEWER_AUDITOR",
      )
    ).statusCode,
    403,
  );
});
test("revoked sessions invalidate access tokens immediately", async () => {
  const sessions = await api(
    "GET",
    "/auth/sessions",
    undefined,
    "WAREHOUSE_STAFF",
  );
  const id = sessions.json().data[0].id;
  assert.equal(
    (await api("DELETE", `/auth/sessions/${id}`, undefined, "WAREHOUSE_STAFF"))
      .statusCode,
    200,
  );
  assert.equal(
    (await api("GET", "/inventory", undefined, "WAREHOUSE_STAFF")).statusCode,
    401,
  );
});

test("refresh rotates cookie and rejects replayed refresh token", async () => {
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin },
    payload: { email: "viewer_auditor@test.example", password },
  });
  const first = String(login.headers["set-cookie"]).split(";")[0];
  const refresh = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    headers: { origin, cookie: first, "content-type": "application/json" },
    payload: "{}",
  });
  assert.equal(refresh.statusCode, 200, refresh.body);
  assert.notEqual(String(refresh.headers["set-cookie"]).split(";")[0], first);
  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    headers: { origin, cookie: first },
    payload: {},
  });
  assert.equal(replay.statusCode, 401);
});

async function previewFile(
  filename: string,
  buffer: Buffer,
  path = "/imports/preview/pincodes",
  fields: Record<string, string> = {},
  role = "SUPER_ADMIN",
) {
  const boundary = "elms-test-file-boundary";
  const payload = Buffer.concat([
    ...Object.entries(fields).map(([key, value]) =>
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: "POST",
    url: `/api/v1${path}`,
    payload,
    headers: {
      origin,
      authorization: `Bearer ${tokens[role]}`,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  });
}

test("employee photos replace safely and private attachments enforce conversation ownership", async () => {
  const warehouseLogin = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin },
    payload: { email: "warehouse_staff@test.example", password },
  });
  assert.equal(warehouseLogin.statusCode, 200);
  tokens.WAREHOUSE_STAFF = warehouseLogin.json().data.accessToken;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXwAAAABJRU5ErkJggg==",
    "base64",
  );
  const photo = await previewFile("photo.png", png, "/profile/photo");
  assert.equal(photo.statusCode, 200, photo.body);
  const photoId = photo.json().data.id;
  assert.equal(
    (await api("GET", "/profile")).json().data.profile.avatarFileId,
    photoId,
  );
  assert.equal(
    (await api("GET", `/files/${photoId}`, undefined, "WAREHOUSE_STAFF"))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await previewFile(
        "fake.png",
        Buffer.from("not an image"),
        "/profile/photo",
      )
    ).statusCode,
    422,
  );
  const replaced = await previewFile("photo.png", png, "/profile/photo");
  assert.equal(replaced.statusCode, 200);
  assert.equal((await api("GET", `/files/${photoId}`)).statusCode, 404);
  assert.equal((await api("DELETE", "/profile/photo")).statusCode, 200);
  assert.equal(
    (await api("GET", "/profile")).json().data.profile.avatarFileId,
    null,
  );
  const sent = await previewFile(
    "handover.txt",
    Buffer.from("Packing handover sample"),
    "/messages/with-file",
    { recipientId: "LOGISTICS_MANAGER", body: "Private attachment reference" },
  );
  assert.equal(sent.statusCode, 200, sent.body);
  const f = sent.json().data.attachments[0];
  assert.equal(f.content, undefined);
  const received = await api(
    "GET",
    `/files/${f.id}`,
    undefined,
    "LOGISTICS_MANAGER",
  );
  assert.equal(received.statusCode, 200);
  assert.equal(received.body, "Packing handover sample");
  assert.match(
    received.headers["content-disposition"] as string,
    /^attachment/,
  );
  assert.match(String(received.headers["cache-control"]), /no-store/);
  assert.equal(
    (await api("GET", `/files/${f.id}`, undefined, "WAREHOUSE_STAFF"))
      .statusCode,
    404,
  );
  assert.equal((await app.inject(`/api/v1/files/${f.id}`)).statusCode, 401);
  const results = (
    await api(
      "GET",
      "/messages?recipientId=SUPER_ADMIN&search=attachment",
      undefined,
      "LOGISTICS_MANAGER",
    )
  ).json().data;
  assert.ok(results.some((m: { id: string }) => m.id === sent.json().data.id));
  assert.equal(
    (
      await api(
        "GET",
        "/messages?search=attachment",
        undefined,
        "WAREHOUSE_STAFF",
      )
    ).json().data.length,
    0,
  );
  assert.equal(
    (await api("DELETE", `/files/${f.id}`, undefined, "LOGISTICS_MANAGER"))
      .statusCode,
    404,
  );
  assert.equal((await api("DELETE", `/files/${f.id}`)).statusCode, 200);
  assert.equal(
    (await api("GET", `/files/${f.id}`, undefined, "LOGISTICS_MANAGER"))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await previewFile(
        "update.txt",
        Buffer.from("update"),
        "/messages/with-file",
        { channel: "announcements" },
        "WAREHOUSE_STAFF",
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await previewFile(
        "page.html",
        Buffer.from("<html>no</html>"),
        "/messages/with-file",
      )
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await previewFile(
        "large.txt",
        Buffer.alloc(2 * 1024 * 1024 + 1, "x"),
        "/messages/with-file",
      )
    ).statusCode,
    413,
  );
});
test("file preview supports Excel, DOCX and structured PDF with one-time commit", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["code", "city", "state", "serviceable"],
      ["560001", "Bengaluru", "Karnataka", "true"],
    ]),
    "Locations",
  );
  for (const format of ["xlsx", "xls"] as const) {
    const response = await previewFile(
      `locations.${format}`,
      XLSX.write(workbook, {
        type: "buffer",
        bookType: format === "xls" ? "biff8" : "xlsx",
      }),
    );
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().data.valid, 1);
  }
  const cells = (values: string[]) =>
    `<w:tr>${values.map((v) => `<w:tc><w:p><w:r><w:t>${v}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`;
  const docx = zipSync({
    "word/document.xml": strToU8(
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>${cells(["code", "city", "state", "serviceable"])}${cells(["560001", "Bengaluru", "Karnataka", "true"])}</w:tbl></w:body></w:document>`,
    ),
    "[Content_Types].xml": strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
  });
  const response = await previewFile("locations.docx", Buffer.from(docx));
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().data.invalid, 0);
  const batchId = response.json().data.id;
  assert.equal(
    (await api("POST", `/imports/${batchId}/commit`, {})).statusCode,
    200,
  );
  assert.equal(
    (await api("POST", `/imports/${batchId}/commit`, {})).statusCode,
    409,
  );
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on("data", (b) => chunks.push(b));
  const finished = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );
  doc.text("code,city,state,serviceable");
  doc.text("560001,Bengaluru,Karnataka,true");
  doc.end();
  const pdfPreview = await previewFile("locations.pdf", await finished);
  assert.equal(pdfPreview.statusCode, 200, pdfPreview.body);
  assert.equal(pdfPreview.json().data.valid, 1);
  assert.equal(
    (await previewFile("bad.xlsx", Buffer.from("not a workbook"))).statusCode,
    400,
  );
  assert.equal(
    (await previewFile("bad.csv", Buffer.from([0, 1, 2]))).statusCode,
    400,
  );
});

test("concurrent packers cannot spend the same stock twice", async () => {
  // The revocation test deliberately invalidates the original warehouse session.
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin },
    payload: { email: "warehouse_staff@test.example", password },
  });
  assert.equal(login.statusCode, 200, login.body);
  tokens.WAREHOUSE_STAFF = login.json().data.accessToken;
  await prisma.inventoryItem.create({
    data: {
      id: "racebook",
      name: "Concurrency material",
      sku: "RACE",
      unitCost: "10",
    },
  });
  await prisma.kit.create({
    data: {
      id: "racekit",
      name: "Concurrency kit",
      courseId: "cat",
      milestoneNumber: 1,
      weightKg: 1,
      items: { create: { itemId: "racebook", quantity: 2 } },
    },
  });
  await prisma.stock.create({
    data: { itemId: "racebook", centerId: "mumbai", quantity: 2 },
  });
  for (const id of ["race-a", "race-b"]) {
    await prisma.student.create({
      data: {
        ...student(id),
        enrollmentDate: new Date("2026-10-01"),
        status: "ACTIVE",
      },
    });
    await prisma.milestoneStatus.create({
      data: { studentId: id, milestoneNumber: 1, paid: true, amount: "16000" },
    });
    await prisma.dispatch.create({
      data: {
        id: `dispatch-${id}`,
        studentId: id,
        kitId: "racekit",
        status: "QUEUED",
        deliveryMode: "COURIER",
        courierPartnerId: "courier",
        createdById: "SUPER_ADMIN",
      },
    });
  }
  const responses = await Promise.all(
    ["race-a", "race-b"].map((id) =>
      api(
        "POST",
        "/warehouse-packing",
        {
          ids: [`dispatch-${id}`],
          warehouseId: "mumbai",
        },
        "WAREHOUSE_STAFF",
      ),
    ),
  );
  assert.deepEqual(
    responses.map((r) => r.statusCode).sort(),
    [200, 422],
    responses.map((r) => r.body).join("\n"),
  );
  assert.equal(
    (
      await prisma.stock.findUniqueOrThrow({
        where: { itemId_centerId: { itemId: "racebook", centerId: "mumbai" } },
      })
    ).quantity,
    0,
  );
  assert.equal(
    await prisma.stockMovement.count({ where: { itemId: "racebook" } }),
    1,
  );
});
test("capacity probe uses 50000 students and packs 500 shipments atomically", async () => {
  for (let start = 0; start < 50000; start += 2500) {
    await prisma.student.createMany({
      data: Array.from({ length: 2500 }, (_, i) => ({
        ...student(`load-${String(start + i).padStart(5, "0")}`),
        enrollmentDate: new Date("2026-10-01"),
        status: "ACTIVE" as const,
      })),
    });
  }
  const probeLogin = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { origin },
    payload: { email: "super_admin@test.example", password },
  });
  assert.equal(probeLogin.statusCode, 200);
  tokens.SUPER_ADMIN = probeLogin.json().data.accessToken;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const response = await api("GET", "/dashboard");
    assert.equal(response.statusCode, 200, response.body);
    samples.push(performance.now() - start);
  }
  const ids = Array.from(
    { length: 500 },
    (_, i) => `load-${String(i).padStart(5, "0")}`,
  );
  await prisma.milestoneStatus.createMany({
    data: ids.map((studentId) => ({
      studentId,
      milestoneNumber: 1,
      paid: true,
      amount: "16000",
    })),
  });
  await prisma.dispatch.createMany({
    data: ids.map((studentId) => ({
      id: `shipment-${studentId}`,
      studentId,
      kitId: "cat-a",
      status: "QUEUED" as const,
      deliveryMode: "COURIER" as const,
      courierPartnerId: "courier",
      createdById: "SUPER_ADMIN",
    })),
  });
  await api("POST", "/inventory/adjust", {
    itemId: "book",
    centerId: "mumbai",
    quantity: 1000,
    reason: "Capacity test replenishment",
  });
  const start = performance.now();
  const packed = await api("POST", "/dispatches/transition", {
    ids: ids.map((id) => `shipment-${id}`),
    status: "PACKED",
    warehouseId: "mumbai",
  });
  const elapsed = performance.now() - start;
  assert.equal(packed.statusCode, 200, packed.body);
  assert.equal(packed.json().data.updated, 500);
  process.stdout.write(
    `CAPACITY_MEASUREMENT students=${await prisma.student.count()} dashboard_max_ms=${Math.round(Math.max(...samples))} bulk500_ms=${Math.round(elapsed)}\n`,
  );
});
