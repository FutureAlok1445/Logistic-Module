import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { protect, ok } from "../../http";
import { AppError } from "../../shared/errors";
import { transaction, audit } from "../logistics/transaction";
import { parseDocument } from "../logistics/imports";
import { safeCell } from "../logistics/reports";
import { parseTextTable } from "shared-types";
import { employeeFileRoutes, fileMetadata } from "./files";

const idParams = (p: unknown) =>
  z.object({ id: z.string().max(100) }).parse(p).id;
const employeeSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  profile: true,
} as const;
const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  jobTitle: z.string().trim().max(100).default(""),
  department: z.string().trim().max(100).default("Logistics"),
  location: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(30).default(""),
  bio: z.string().trim().max(500).default(""),
  availability: z
    .enum(["AVAILABLE", "BUSY", "AWAY", "OFFLINE"])
    .default("AVAILABLE"),
  statusMessage: z.string().trim().max(160).default(""),
});
const viewSchema = z.object({
  sheet: z.number().int().min(0).max(19).optional(),
  header: z.number().int().min(0).max(29).optional(),
  group: z.string().max(150).optional(),
  measure: z.string().max(150).optional(),
  hidden: z.array(z.string().max(150)).max(100).optional(),
  chart: z.enum(["bar", "line", "area", "histogram", "scatter"]).optional(),
  aggregate: z.enum(["sum", "mean", "min", "max", "count"]).optional(),
  filters: z
    .array(
      z.object({
        column: z.string().max(150),
        operator: z.enum([
          "contains",
          "equals",
          "not_equals",
          "blank",
          "not_blank",
          "gt",
          "lt",
          "after",
          "before",
        ]),
        value: z.string().max(2000),
      }),
    )
    .max(12)
    .optional(),
});
export function workbookSheets(matrices: unknown[][][], names?: string[]) {
  let total = 0;
  const sheets = matrices
    .map((matrix, i) => {
      const rows = matrix
        .filter((r) => r.some((v) => String(v ?? "").trim()))
        .map((r) =>
          r.slice(0, 100).map((v) =>
            String(v ?? "")
              .trim()
              .slice(0, 2000),
          ),
        );
      total += Math.max(0, rows.length - 1);
      return { name: names?.[i] ?? `Sheet ${i + 1}`, rows };
    })
    .filter((s) => s.rows.length);
  if (!sheets.length)
    throw new AppError(422, "EMPTY_WORKBOOK", "No tabular rows found");
  if (total > 1000)
    throw new AppError(
      422,
      "ROW_LIMIT",
      "Split workbook into at most 1000 data rows plus headers across all sheets",
    );
  return { sheets, rowCount: total };
}
export async function employeeWorkspaceRoutes(app: FastifyInstance) {
  await employeeFileRoutes(app);
  app.post(
    "/workbooks/extract-text",
    { preHandler: protect(app, "import:write") },
    async (req) => {
      const file = await req.file();
      if (!file)
        throw new AppError(
          400,
          "FILE_REQUIRED",
          "Choose a text PDF or Word document",
        );
      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
      if (!["pdf", "docx"].includes(ext))
        throw new AppError(
          422,
          "FILE_TYPE",
          "Use PDF or DOCX for text extraction",
        );
      const buffer = await file.toBuffer();
      if (file.file.truncated)
        throw new AppError(413, "FILE_LIMIT", "Maximum document size is 5 MB");
      const result = await parseDocument(buffer, ext);
      if (!result.text?.trim())
        throw new AppError(
          422,
          "TEXT_UNAVAILABLE",
          "No bounded selectable text found. Use a smaller document or a text export; scanned OCR is not configured.",
        );
      return ok({ text: result.text });
    },
  );
  app.get("/inbox", { preHandler: protect(app) }, async (req) => {
    const since = new Date(Date.now() - 7 * 86400000);
    const [messages, tasks] = await Promise.all([
      prisma.teamMessage.findMany({
        where: {
          createdAt: { gte: since },
          senderId: { not: req.employee.id },
          OR: [
            { recipientId: req.employee.id },
            {
              recipientId: null,
              channel: { in: ["operations", "warehouse", "announcements"] },
            },
          ],
        },
        include: { sender: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.workTask.findMany({
        where: { assigneeId: req.employee.id, status: { not: "DONE" } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);
    return ok(
      [
        ...messages.map((m) => ({
          id: `message:${m.id}`,
          title: m.recipientId
            ? `Message from ${m.sender.fullName}`
            : `${m.channel} · ${m.sender.fullName}`,
          body: m.body.slice(0, 240),
          createdAt: m.createdAt,
          href: "/team",
          kind: "message",
        })),
        ...tasks.map((t) => ({
          id: `task:${t.id}:${t.updatedAt.toISOString()}`,
          title: t.title,
          body: `${t.priority} priority · ${t.status}${t.dueAt ? ` · due ${t.dueAt.toISOString().slice(0, 10)}` : ""}`,
          createdAt: t.updatedAt,
          href: "/team",
          kind: "task",
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  });
  app.post(
    "/workbooks/from-text",
    { preHandler: protect(app, "import:write") },
    async (req) => {
      const b = z
        .object({
          name: z.string().trim().min(1).max(150),
          text: z.string().min(1).max(100000),
          mode: z.enum(["delimited", "keyvalue", "lines"]),
          delimiter: z.enum([",", "\t", ";", "|"]).default(","),
          hasHeader: z.boolean().default(true),
        })
        .parse(req.body);
      let rows: string[][];
      try {
        rows = parseTextTable(b.text, b.mode, b.delimiter, b.hasHeader);
      } catch (error) {
        throw new AppError(
          422,
          "TEXT_REVIEW_REQUIRED",
          (error as Error).message,
        );
      }
      const data = workbookSheets([rows], ["Reviewed text"]);
      return ok(
        await transaction(async (tx) => {
          const w = await tx.workbookDataset.create({
            data: {
              name: b.name,
              filename: "reviewed-text.txt",
              ownerId: req.employee.id,
              ...data,
              sheets: data.sheets as Prisma.InputJsonValue,
            },
          });
          await audit(
            tx,
            req.employee.id,
            "TEXT_WORKBOOK_REVIEWED",
            "WorkbookDataset",
            w.id,
            { mode: b.mode, rowCount: data.rowCount },
          );
          return w;
        }),
      );
    },
  );
  app.post(
    "/workbooks/:id/export-view",
    { preHandler: protect(app, "reports:export") },
    async (req, reply) => {
      const b = z
        .object({
          sheet: z.number().int().min(0).max(19),
          header: z.number().int().min(0).max(29),
          columns: z.array(z.number().int().min(0).max(99)).min(1).max(100),
          rows: z.array(z.number().int().min(0).max(1031)).max(1000),
        })
        .parse(req.body);
      const w = await prisma.workbookDataset.findFirstOrThrow({
          where: { id: idParams(req.params), ownerId: req.employee.id },
        }),
        matrix = (w.sheets as { rows: string[][] }[])[b.sheet]?.rows;
      if (
        !matrix ||
        !matrix[b.header] ||
        b.rows.some((i) => i <= b.header || i >= matrix.length)
      )
        throw new AppError(
          422,
          "INVALID_VIEW",
          "Choose valid source worksheet rows",
        );
      const cells = [
        b.columns.map((i) => matrix[b.header][i] || `Column ${i + 1}`),
        ...b.rows.map((i) => b.columns.map((c) => matrix[i][c] ?? "")),
      ].map((r) => r.map(safeCell));
      await transaction((tx) =>
        audit(
          tx,
          req.employee.id,
          "WORKBOOK_VIEW_EXPORTED",
          "WorkbookDataset",
          w.id,
          { rows: b.rows.length, columns: b.columns.length },
        ),
      );
      return reply
        .type("text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="ims-filtered-view.csv"',
        )
        .send(
          "\uFEFF" + XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(cells)),
        );
    },
  );
  app.get(
    "/workbook-templates/:id",
    { preHandler: protect(app, "import:write") },
    async (req, reply) => {
      const kind = z
        .enum(["students", "payments", "items", "pincodes"])
        .parse(idParams(req.params));
      const columns = {
        students: [
          "id",
          "name",
          "mobile",
          "email",
          "address",
          "city",
          "state",
          "pincode",
          "courseId",
          "centerId",
          "enrollmentDate",
          "status",
          "paymentPlanId",
          "batchId",
          "notes",
        ],
        payments: ["studentId", "milestoneNumber", "amount", "paid", "paidAt"],
        items: ["sku", "name", "unitCost", "pages", "lowStockThreshold"],
        pincodes: ["code", "city", "state", "serviceable"],
      }[kind];
      const wb = XLSX.utils.book_new(),
        sheet = XLSX.utils.aoa_to_sheet([columns]);
      sheet["!cols"] = columns.map((c) => ({
        wch: Math.max(18, c.length + 3),
      }));
      XLSX.utils.book_append_sheet(wb, sheet, "Data");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          ["IMS import guidance"],
          ["Use existing database IDs for courses, centres and payment plans."],
          [
            "Students and payments require authorised Admissions/Finance credentials at commit.",
          ],
          [
            "No operational records are created by downloading or analysing this workbook.",
          ],
          [
            "Maximum 1000 rows per upload; dates use ISO format; paid/serviceable use true or false.",
          ],
        ]),
        "Instructions",
      );
      return reply
        .type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(
          "Content-Disposition",
          `attachment; filename="ims-${kind}-template.xlsx"`,
        )
        .send(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    },
  );
  app.get("/profile", { preHandler: protect(app) }, async (req) =>
    ok(
      await prisma.employee.findUniqueOrThrow({
        where: { id: req.employee.id },
        select: employeeSelect,
      }),
    ),
  );
  app.put("/profile", { preHandler: protect(app) }, async (req) => {
    const { fullName, ...profile } = profileSchema.parse(req.body);
    return ok(
      await transaction(async (tx) => {
        const employee = await tx.employee.update({
          where: { id: req.employee.id },
          data: {
            fullName,
            profile: { upsert: { create: profile, update: profile } },
          },
          select: employeeSelect,
        });
        await audit(
          tx,
          req.employee.id,
          "PROFILE_UPDATED",
          "Employee",
          req.employee.id,
          { fields: Object.keys(profile) },
        );
        return employee;
      }),
    );
  });
  app.post("/presence", { preHandler: protect(app) }, async (req) => {
    await prisma.employeeProfile.upsert({
      where: { employeeId: req.employee.id },
      create: { employeeId: req.employee.id },
      update: { lastSeenAt: new Date() },
    });
    return ok({ updated: true });
  });
  app.get("/team", { preHandler: protect(app) }, async (req) => {
    const q = z
      .object({ search: z.string().max(100).default("") })
      .parse(req.query);
    return ok(
      await prisma.employee.findMany({
        where: {
          isActive: true,
          ...(q.search
            ? {
                OR: [
                  { fullName: { contains: q.search, mode: "insensitive" } },
                  { email: { contains: q.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: employeeSelect,
        orderBy: { fullName: "asc" },
        take: 100,
      }),
    );
  });
  app.get("/messages", { preHandler: protect(app) }, async (req) => {
    const q = z
      .object({
        recipientId: z.string().max(100).optional(),
        channel: z
          .enum(["operations", "warehouse", "announcements"])
          .default("operations"),
        search: z.string().trim().max(100).default(""),
      })
      .parse(req.query);
    const where: Prisma.TeamMessageWhereInput = q.recipientId
      ? {
          OR: [
            { senderId: req.employee.id, recipientId: q.recipientId },
            { senderId: q.recipientId, recipientId: req.employee.id },
          ],
        }
      : { recipientId: null, channel: q.channel };
    return ok(
      (
        await prisma.teamMessage.findMany({
          where: {
            AND: [
              where,
              ...(q.search
                ? [
                    {
                      body: {
                        contains: q.search,
                        mode: "insensitive" as const,
                      },
                    },
                  ]
                : []),
            ],
          },
          include: {
            sender: { select: { id: true, fullName: true } },
            attachments: { select: fileMetadata },
          },
          take: 100,
          orderBy: { createdAt: "desc" },
        })
      ).reverse(),
    );
  });
  app.post("/messages", { preHandler: protect(app) }, async (req) => {
    const b = z
      .object({
        recipientId: z.string().max(100).optional(),
        channel: z
          .enum(["operations", "warehouse", "announcements"])
          .default("operations"),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(req.body);
    if (
      !b.recipientId &&
      b.channel === "announcements" &&
      !["SUPER_ADMIN", "LOGISTICS_MANAGER"].includes(req.employee.role)
    )
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only managers can post company announcements",
      );
    if (
      b.recipientId &&
      !(await prisma.employee.findFirst({
        where: { id: b.recipientId, isActive: true },
      }))
    )
      throw new AppError(
        422,
        "RECIPIENT_UNAVAILABLE",
        "Choose an active employee",
      );
    return ok(
      await transaction(async (tx) => {
        const m = await tx.teamMessage.create({
          data: { ...b, senderId: req.employee.id },
          include: { sender: { select: { id: true, fullName: true } } },
        });
        await audit(tx, req.employee.id, "MESSAGE_SENT", "TeamMessage", m.id, {
          channel: b.channel,
          recipientId: b.recipientId,
        });
        return m;
      }),
    );
  });
  app.get("/tasks", { preHandler: protect(app) }, async (req) => {
    const manager = ["SUPER_ADMIN", "LOGISTICS_MANAGER"].includes(
      req.employee.role,
    );
    return ok(
      await prisma.workTask.findMany({
        where: manager
          ? {}
          : {
              OR: [
                { assigneeId: req.employee.id },
                { creatorId: req.employee.id },
              ],
            },
        include: {
          assignee: { select: { fullName: true } },
          creator: { select: { fullName: true } },
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        take: 100,
      }),
    );
  });
  app.post("/tasks", { preHandler: protect(app) }, async (req) => {
    const b = z
      .object({
        title: z.string().trim().min(3).max(150),
        description: z.string().trim().max(2000).default(""),
        priority: z.enum(["NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
        assigneeId: z.string().max(100),
        dueAt: z.iso.datetime().optional(),
        reference: z.string().trim().max(100).default(""),
      })
      .parse(req.body);
    if (req.employee.role === "VIEWER_AUDITOR")
      throw new AppError(403, "FORBIDDEN", "Auditor role cannot assign work");
    if (
      !["SUPER_ADMIN", "LOGISTICS_MANAGER"].includes(req.employee.role) &&
      b.assigneeId !== req.employee.id
    )
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only managers can assign another employee",
      );
    if (
      !(await prisma.employee.findFirst({
        where: { id: b.assigneeId, isActive: true },
      }))
    )
      throw new AppError(
        422,
        "ASSIGNEE_UNAVAILABLE",
        "Choose an active employee",
      );
    return ok(
      await transaction(async (tx) => {
        const t = await tx.workTask.create({
          data: { ...b, creatorId: req.employee.id },
        });
        await audit(tx, req.employee.id, "TASK_CREATED", "WorkTask", t.id);
        return t;
      }),
    );
  });
  app.patch("/tasks/:id", { preHandler: protect(app) }, async (req) => {
    const id = idParams(req.params),
      b = z
        .object({ status: z.enum(["TODO", "IN_PROGRESS", "DONE"]) })
        .parse(req.body);
    return ok(
      await transaction(async (tx) => {
        const t = await tx.workTask.findUniqueOrThrow({ where: { id } });
        if (
          req.employee.role === "VIEWER_AUDITOR" ||
          (!["SUPER_ADMIN", "LOGISTICS_MANAGER"].includes(req.employee.role) &&
            t.assigneeId !== req.employee.id)
        )
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only assignee or manager can update this task",
          );
        const updated = await tx.workTask.update({ where: { id }, data: b });
        await audit(
          tx,
          req.employee.id,
          "TASK_STATUS_UPDATED",
          "WorkTask",
          id,
          b,
        );
        return updated;
      }),
    );
  });
  app.get(
    "/workbooks",
    { preHandler: protect(app, "reports:read") },
    async (req) =>
      ok(
        await prisma.workbookDataset.findMany({
          where: { ownerId: req.employee.id },
          select: {
            id: true,
            name: true,
            filename: true,
            rowCount: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ),
  );
  app.post(
    "/workbooks",
    { preHandler: protect(app, "import:write") },
    async (req) => {
      const file = await req.file();
      if (!file)
        throw new AppError(400, "FILE_REQUIRED", "Upload an IMS workbook");
      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
      if (!["xlsx", "xls", "csv", "pdf", "docx"].includes(ext))
        throw new AppError(
          422,
          "FILE_TYPE",
          "Use Excel, CSV, structured PDF or Word",
        );
      const buffer = await file.toBuffer();
      if (file.file.truncated)
        throw new AppError(413, "FILE_LIMIT", "Maximum file size is 5 MB");
      const parsed = await parseDocument(buffer, ext),
        data = workbookSheets(parsed.matrices, parsed.names);
      const safeName = file.filename
        .replace(/[\\/\u0000-\u001f]/g, "_")
        .slice(0, 150);
      return ok(
        await transaction(async (tx) => {
          const w = await tx.workbookDataset.create({
            data: {
              name: safeName,
              filename: safeName,
              ownerId: req.employee.id,
              ...data,
              sheets: data.sheets as Prisma.InputJsonValue,
            },
          });
          await audit(
            tx,
            req.employee.id,
            "WORKBOOK_UPLOADED",
            "WorkbookDataset",
            w.id,
            { filename: safeName, rowCount: data.rowCount },
          );
          return w;
        }),
      );
    },
  );
  app.get(
    "/workbooks/:id",
    { preHandler: protect(app, "reports:read") },
    async (req) =>
      ok(
        await prisma.workbookDataset.findFirstOrThrow({
          where: { id: idParams(req.params), ownerId: req.employee.id },
        }),
      ),
  );
  app.patch(
    "/workbooks/:id",
    { preHandler: protect(app, "import:write") },
    async (req) => {
      const id = idParams(req.params),
        b = z
          .object({ name: z.string().trim().min(1).max(150), view: viewSchema })
          .parse(req.body);
      return ok(
        await transaction(async (tx) => {
          await tx.workbookDataset.findFirstOrThrow({
            where: { id, ownerId: req.employee.id },
          });
          const w = await tx.workbookDataset.update({
            where: { id },
            data: { name: b.name, view: b.view as Prisma.InputJsonValue },
          });
          await audit(
            tx,
            req.employee.id,
            "WORKBOOK_VIEW_SAVED",
            "WorkbookDataset",
            id,
          );
          return w;
        }),
      );
    },
  );
  app.delete(
    "/workbooks/:id",
    { preHandler: protect(app, "import:write") },
    async (req) => {
      const id = idParams(req.params);
      return ok(
        await transaction(async (tx) => {
          await tx.workbookDataset.findFirstOrThrow({
            where: { id, ownerId: req.employee.id },
          });
          await tx.workbookDataset.delete({ where: { id } });
          await audit(
            tx,
            req.employee.id,
            "WORKBOOK_DELETED",
            "WorkbookDataset",
            id,
          );
          return { deleted: true };
        }),
      );
    },
  );
  app.get(
    "/workbooks/:id/export",
    { preHandler: protect(app, "reports:export") },
    async (req, reply) => {
      const w = await prisma.workbookDataset.findFirstOrThrow({
        where: { id: idParams(req.params), ownerId: req.employee.id },
      });
      const wb = XLSX.utils.book_new();
      for (const [i, s] of (
        w.sheets as { name: string; rows: string[][] }[]
      ).entries())
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(s.rows.map((r) => r.map(safeCell))),
          `${i + 1}-${s.name}`.replace(/[\[\]:*?/\\]/g, "_").slice(0, 31),
        );
      await transaction((tx) =>
        audit(
          tx,
          req.employee.id,
          "WORKBOOK_EXPORTED",
          "WorkbookDataset",
          w.id,
        ),
      );
      return reply
        .type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(
          "Content-Disposition",
          'attachment; filename="ims-workbook.xlsx"',
        )
        .send(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    },
  );
}
