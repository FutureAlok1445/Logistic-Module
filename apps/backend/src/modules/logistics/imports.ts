import { FastifyInstance } from "fastify";
import { fork } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";
import { prisma } from "../../config/database";
import { protect, ok } from "../../http";
import { hasPermission } from "../../shared/constants/permissions";
import { AppError } from "../../shared/errors";
import { masterSchemas, studentSchema, paymentSchema } from "./schemas";
import { verifyProvider, ingestStudents, ingestPayments } from "./ingestion";
import { transaction, audit } from "./transaction";

const kindSchema = z.enum(["pincodes", "items", "students", "payments"]);
const aliases: Record<string, string> = {
  studname: "name",
  studentname: "name",
  studentid: "id",
  mobno: "mobile",
  mobileno: "mobile",
  mobilenumber: "mobile",
  phone: "mobile",
  zipcode: "pincode",
  postalcode: "pincode",
  pin: "pincode",
  course: "courseId",
  courseid: "courseId",
  center: "centerId",
  centre: "centerId",
  centerid: "centerId",
  milestone: "milestoneNumber",
  milestonenumber: "milestoneNumber",
  student: "studentId",
  studentidpayment: "studentId",
  unitcost: "unitCost",
  lowstockthreshold: "lowStockThreshold",
  enrollmentdate: "enrollmentDate",
  paymentplanid: "paymentPlanId",
  paidat: "paidAt",
};
function validateZip(buffer: Buffer) {
  let expanded = 0;
  let entries = 0;
  for (let i = 0; i + 46 < buffer.length; i++)
    if (buffer.readUInt32LE(i) === 0x02014b50) {
      expanded += buffer.readUInt32LE(i + 24);
      entries++;
      if (expanded > 50 * 1024 * 1024 || entries > 5000)
        throw new AppError(
          413,
          "ARCHIVE_LIMIT",
          "File expands beyond the safe import limit",
        );
    }
  if (!entries)
    throw new AppError(400, "INVALID_ARCHIVE", "Invalid document archive");
}
export async function parseDocument(
  buffer: Buffer,
  ext: string,
): Promise<{ matrices: unknown[][][]; names?: string[]; text?: string }> {
  if (["xlsx", "docx"].includes(ext)) {
    if (buffer.subarray(0, 2).toString() !== "PK")
      throw new AppError(
        400,
        "TYPE_MISMATCH",
        "Document signature does not match extension",
      );
    validateZip(buffer);
  }
  if (ext === "pdf" && buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new AppError(400, "TYPE_MISMATCH", "Invalid PDF signature");
  if (
    ext === "xls" &&
    buffer.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1"
  )
    throw new AppError(400, "TYPE_MISMATCH", "Invalid Excel signature");
  if (ext === "csv" && buffer.includes(0))
    throw new AppError(400, "INVALID_CSV", "CSV must be plain text");
  return new Promise((accept, reject) => {
    const worker = fork(
      resolve(__dirname, "../../../scripts/parse-worker.cjs"),
      [],
      {
        execArgv: ["--max-old-space-size=192"],
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
    worker.send({ buffer: buffer.toString("base64"), ext });
    const timeout = setTimeout(() => {
      worker.kill();
      reject(
        new AppError(
          422,
          "PARSE_TIMEOUT",
          "File parsing exceeded 15 seconds. Split the file.",
        ),
      );
    }, 15000);
    worker.once("message", (message) => {
      const result = message as {
        error?: string;
        matrices: unknown[][][];
        text?: string;
        names?: string[];
      };
      clearTimeout(timeout);
      worker.kill();
      if (result.error) reject(new AppError(422, "PARSE_ERROR", result.error));
      else accept(result);
    });
    worker.once("error", () => {
      clearTimeout(timeout);
      reject(
        new AppError(
          422,
          "PARSE_ERROR",
          "File could not be parsed within safe resource limits",
        ),
      );
    });
    worker.once("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0)
        reject(new AppError(422, "PARSE_ERROR", "File parser stopped"));
    });
  });
}
async function parseFile(buffer: Buffer, ext: string) {
  return (await parseDocument(buffer, ext)).matrices;
}
export function reviewRows(
  matrices: unknown[][][],
  kind: z.infer<typeof kindSchema>,
) {
  const rows: {
    row: number;
    data: Record<string, unknown>;
    errors: string[];
  }[] = [];
  const seen = new Set<string>();
  const schema =
    kind === "students"
      ? studentSchema
      : kind === "payments"
        ? paymentSchema
        : masterSchemas[kind];
  const canonical = Object.fromEntries(
    Object.keys(schema.shape).map((k) => [k.toLowerCase(), k]),
  );
  const mapHeader = (v: unknown) => {
    const original = String(v).trim();
    const key = original.toLowerCase().replace(/[^a-z0-9]/g, "");
    return aliases[key] ?? canonical[key] ?? original;
  };
  for (const matrix of matrices) {
    const scores = matrix
      .slice(0, 30)
      .map(
        (row) =>
          row
            .map(mapHeader)
            .filter(
              (k) => k in schema.shape || (k === "id" && kind === "payments"),
            ).length,
      );
    const best = Math.max(0, ...scores);
    const headerIndex = best >= 2 ? scores.indexOf(best) : -1;
    if (headerIndex < 0) continue;
    const headers = matrix[headerIndex].map(mapHeader);
    if (kind === "payments") {
      const pos = headers.indexOf("id");
      if (pos >= 0) headers[pos] = "studentId";
    }
    for (const line of matrix.slice(headerIndex + 1)) {
      if (!line.some((v) => String(v).trim())) continue;
      if (line.map(mapHeader).filter((h, i) => h === headers[i]).length >= 2)
        continue;
      if (rows.length >= 1000)
        throw new AppError(
          422,
          "ROW_LIMIT",
          "Split files into at most 1000 data rows",
        );
      const data: Record<string, unknown> = Object.fromEntries(
        headers.map((h, i) => [h, String(line[i] ?? "").trim()]),
      );
      if (data.mobile) {
        const digits = String(data.mobile).replace(/\D/g, "");
        data.mobile =
          digits.length === 12 && digits.startsWith("91")
            ? digits.slice(2)
            : digits;
      }
      for (const key of ["paid", "serviceable"])
        if (key in data)
          data[key] = /^(true|yes|1|paid)$/i.test(String(data[key]));
      if (kind === "pincodes" && data.pincode && !data.code)
        data.code = data.pincode;
      if (kind === "students") {
        if (!data.email) delete data.email;
        if (!data.batchId) delete data.batchId;
      }
      if (kind === "payments" && !data.paidAt) delete data.paidAt;
      const validation = schema.safeParse(data);
      const errors = validation.success
        ? []
        : validation.error.issues.map(
            (e) => `${e.path.join(".")}: ${e.message}`,
          );
      const identity =
        kind === "payments"
          ? `${data.studentId}:${data.milestoneNumber}`
          : String(data.id ?? data.code ?? data.sku ?? "");
      if (seen.has(identity)) errors.push("Duplicate row identity");
      seen.add(identity);
      rows.push({
        row: rows.length + 1,
        data: validation.success
          ? JSON.parse(JSON.stringify(validation.data))
          : data,
        errors,
      });
    }
  }
  if (!rows.length)
    throw new AppError(
      422,
      "NO_ROWS",
      "No structured rows detected. Use column headers and a table.",
    );
  return rows;
}
export async function importRoutes(app: FastifyInstance) {
  app.post(
    "/preview/:kind",
    {
      preHandler: protect(app, "import:write"),
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req) => {
      const kind = kindSchema.parse((req.params as { kind: string }).kind);
      if (
        ["items", "pincodes"].includes(kind) &&
        !hasPermission(req.employee.role, "config:write")
      )
        throw new AppError(
          403,
          "FORBIDDEN",
          "Master data imports require manager access",
        );
      if (kind === "students" || kind === "payments")
        verifyProvider(req, kind === "payments" ? "finance" : "admissions");
      const file = await req.file();
      if (!file) throw new AppError(400, "NO_FILE", "Choose an import file");
      const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
      if (!["csv", "xlsx", "xls", "pdf", "docx"].includes(ext))
        throw new AppError(
          400,
          "FILE_TYPE",
          "Use CSV, Excel, structured PDF or DOCX",
        );
      const rows = reviewRows(
        await parseFile(await file.toBuffer(), ext),
        kind,
      );
      const existingIds =
        kind === "students"
          ? new Set(
              (
                await prisma.student.findMany({
                  where: { id: { in: rows.map((r) => String(r.data.id)) } },
                  select: { id: true },
                })
              ).map((s) => s.id),
            )
          : new Set<string>();
      const reviewed = rows.map((r) => ({
        ...r,
        updating: existingIds.has(String(r.data.id)),
      }));
      const batch = await prisma.importBatch.create({
        data: {
          employeeId: req.employee.id,
          filename: file.filename
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(0, 200),
          kind,
          rows: JSON.parse(JSON.stringify(reviewed)),
        },
      });
      return ok({
        id: batch.id,
        rows: reviewed,
        valid: rows.filter((r) => !r.errors.length).length,
        invalid: rows.filter((r) => r.errors.length).length,
      });
    },
  );
  app.post(
    "/:id/commit",
    { preHandler: protect(app, "import:write") },
    async (req) => {
      const id = z.string().parse((req.params as { id: string }).id);
      const batch = await prisma.importBatch.findUnique({ where: { id } });
      if (!batch || batch.employeeId !== req.employee.id)
        throw new AppError(404, "NOT_FOUND", "Import preview not found");
      if (batch.kind === "students" || batch.kind === "payments")
        verifyProvider(
          req,
          batch.kind === "payments" ? "finance" : "admissions",
        );
      const rows = z
        .array(
          z.object({
            data: z.record(z.string(), z.unknown()),
            errors: z.array(z.string()),
          }),
        )
        .parse(batch.rows);
      if (rows.some((r) => r.errors.length))
        throw new AppError(
          422,
          "INVALID_ROWS",
          "Fix all error rows and preview a corrected file",
        );
      return ok(
        await transaction(async (tx) => {
          const changed = await tx.importBatch.updateMany({
            where: { id, employeeId: req.employee.id, status: "PREVIEW" },
            data: { status: "COMMITTED", rows: [] },
          });
          if (changed.count !== 1)
            throw new AppError(
              409,
              "ALREADY_COMMITTED",
              "Import already committed",
            );
          if (batch.kind === "students")
            await ingestStudents(
              tx,
              req.employee.id,
              rows.map((r) => r.data),
            );
          else if (batch.kind === "payments")
            await ingestPayments(
              tx,
              req.employee.id,
              rows.map((r) => r.data),
            );
          else
            for (const r of rows) {
              if (batch.kind === "pincodes") {
                const b = masterSchemas.pincodes.parse(r.data);
                await tx.pincode.upsert({
                  where: { code: b.code },
                  create: b,
                  update: b,
                });
              } else {
                const b = masterSchemas.items.parse(r.data);
                await tx.inventoryItem.upsert({
                  where: { sku: b.sku },
                  create: b,
                  update: b,
                });
              }
            }
          await audit(
            tx,
            req.employee.id,
            "IMPORT_COMMITTED",
            "ImportBatch",
            id,
            { kind: batch.kind, rows: rows.length },
          );
          return { imported: rows.length };
        }),
      );
    },
  );
}
