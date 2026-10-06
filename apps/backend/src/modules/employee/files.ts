import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { protect, ok } from "../../http";
import { AppError } from "../../shared/errors";
import { audit, transaction } from "../logistics/transaction";

export const fileMetadata = {
  id: true,
  filename: true,
  mime: true,
  size: true,
} as const;
const types: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
async function readUpload(req: FastifyRequest, avatar = false) {
  const part = await req.file({
    limits: {
      fileSize: avatar ? 512 * 1024 : 2 * 1024 * 1024,
      files: 1,
      fields: 3,
    },
  });
  if (!part)
    throw new AppError(400, "FILE_REQUIRED", "Choose a file to upload");
  let content: Buffer;
  try {
    content = await part.toBuffer();
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 413)
      throw new AppError(
        413,
        "FILE_LIMIT",
        avatar
          ? "Photo must be at most 512 KB"
          : "Attachment must be at most 2 MB",
      );
    throw error;
  }
  if (part.file.truncated)
    throw new AppError(
      413,
      "FILE_LIMIT",
      avatar
        ? "Photo must be at most 512 KB"
        : "Attachment must be at most 2 MB",
    );
  const filename = part.filename
    .replaceAll("\\", "/")
    .split("/")
    .pop()!
    .replace(/[^a-zA-Z0-9_. ()-]/g, "_")
    .slice(0, 120);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = types[ext];
  if (
    !mime ||
    !content.length ||
    (avatar && !["png", "jpg", "jpeg"].includes(ext))
  )
    throw new AppError(
      422,
      "FILE_TYPE",
      avatar
        ? "Choose a PNG or JPEG photo"
        : "Use PNG, JPEG, PDF, TXT, CSV, XLSX or DOCX",
    );
  const valid =
    ext === "png"
      ? content.length >= 24 &&
        content.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
      : ["jpg", "jpeg"].includes(ext)
        ? content.length >= 4 &&
          content.subarray(0, 3).toString("hex") === "ffd8ff" &&
          content.subarray(-2).toString("hex") === "ffd9"
        : ext === "pdf"
          ? content.subarray(0, 5).toString() === "%PDF-"
          : ["xlsx", "docx"].includes(ext)
            ? content.subarray(0, 4).toString("hex") === "504b0304" &&
              content.includes(Buffer.from(ext === "xlsx" ? "xl/" : "word/"))
            : !content.includes(0) &&
              !content.subarray(0, 2).equals(Buffer.from("MZ"));
  if (!valid)
    throw new AppError(
      422,
      "FILE_SIGNATURE",
      "File contents do not match the selected type",
    );
  if (
    ext === "png" &&
    (content.readUInt32BE(16) > 2048 || content.readUInt32BE(20) > 2048)
  )
    throw new AppError(
      422,
      "IMAGE_SIZE",
      "Resize the photo to at most 2048 pixels per side",
    );
  const field = (name: string) => {
    const value = part.fields[name];
    return value && !Array.isArray(value) && value.type === "field"
      ? String(value.value)
      : undefined;
  };
  return {
    filename,
    mime,
    size: content.length,
    content,
    body: field("body"),
    recipientId: field("recipientId"),
    channel: field("channel"),
  };
}
export async function employeeFileRoutes(app: FastifyInstance) {
  app.get("/files/:id", { preHandler: protect(app) }, async (req, reply) => {
    const { id } = z.object({ id: z.string().max(100) }).parse(req.params);
    const f = await prisma.employeeFile.findFirst({
      where: {
        id,
        OR: [
          { kind: "AVATAR", owner: { isActive: true } },
          {
            kind: "MESSAGE",
            message: {
              OR: [
                { senderId: req.employee.id },
                { recipientId: req.employee.id },
                {
                  recipientId: null,
                  channel: { in: ["operations", "warehouse", "announcements"] },
                },
              ],
            },
          },
        ],
      },
    });
    if (!f)
      throw new AppError(
        404,
        "FILE_NOT_FOUND",
        "File unavailable in your conversations",
      );
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header(
        "Content-Disposition",
        `${f.kind === "AVATAR" ? "inline" : "attachment"}; filename="${f.filename}"`,
      )
      .type(f.mime)
      .send(f.content);
  });
  app.post("/profile/photo", { preHandler: protect(app) }, async (req) => {
    const { filename, mime, size, content } = await readUpload(req, true);
    return ok(
      await transaction(async (tx) => {
        // Serialise storage accounting for uploads by the same employee.
        await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${req.employee.id} FOR UPDATE`;
        const f = await tx.employeeFile.create({
          data: {
            ownerId: req.employee.id,
            kind: "AVATAR",
            filename,
            mime,
            size,
            content,
          },
          select: fileMetadata,
        });
        await tx.employeeProfile.upsert({
          where: { employeeId: req.employee.id },
          create: { employeeId: req.employee.id, avatarFileId: f.id },
          update: { avatarFileId: f.id },
        });
        await tx.employeeFile.deleteMany({
          where: {
            ownerId: req.employee.id,
            kind: "AVATAR",
            id: { not: f.id },
          },
        });
        await audit(
          tx,
          req.employee.id,
          "PROFILE_PHOTO_UPDATED",
          "Employee",
          req.employee.id,
          { size },
        );
        return f;
      }),
    );
  });
  app.delete("/profile/photo", { preHandler: protect(app) }, async (req) =>
    ok(
      await transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${req.employee.id} FOR UPDATE`;
        await tx.employeeProfile.updateMany({
          where: { employeeId: req.employee.id },
          data: { avatarFileId: null },
        });
        await tx.employeeFile.deleteMany({
          where: { ownerId: req.employee.id, kind: "AVATAR" },
        });
        await audit(
          tx,
          req.employee.id,
          "PROFILE_PHOTO_REMOVED",
          "Employee",
          req.employee.id,
        );
        return { removed: true };
      }),
    ),
  );
  app.post("/messages/with-file", { preHandler: protect(app) }, async (req) => {
    const upload = await readUpload(req);
    const b = z
      .object({
        body: z.string().trim().max(2000),
        recipientId: z.string().max(100).optional(),
        channel: z.enum(["operations", "warehouse", "announcements"]),
      })
      .parse({
        body: upload.body ?? "",
        recipientId: upload.recipientId || undefined,
        channel: upload.channel ?? "operations",
      });
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
        select: { id: true },
      }))
    )
      throw new AppError(
        422,
        "RECIPIENT_UNAVAILABLE",
        "Choose an active employee",
      );
    return ok(
      await transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${req.employee.id} FOR UPDATE`;
        const usage = await tx.employeeFile.aggregate({
          where: { ownerId: req.employee.id, kind: "MESSAGE" },
          _sum: { size: true },
        });
        if ((usage._sum.size ?? 0) + upload.size > 10 * 1024 * 1024)
          throw new AppError(
            422,
            "STORAGE_LIMIT",
            "Demo attachment storage is limited to 10 MB per employee. Remove an older attachment first.",
          );
        const m = await tx.teamMessage.create({
          data: {
            ...b,
            body: b.body || upload.filename,
            senderId: req.employee.id,
            attachments: {
              create: {
                ownerId: req.employee.id,
                kind: "MESSAGE",
                filename: upload.filename,
                mime: upload.mime,
                size: upload.size,
                content: upload.content,
              },
            },
          },
          include: {
            sender: { select: { id: true, fullName: true } },
            attachments: { select: fileMetadata },
          },
        });
        await audit(
          tx,
          req.employee.id,
          "MESSAGE_FILE_SENT",
          "TeamMessage",
          m.id,
          { size: upload.size, recipientId: b.recipientId, channel: b.channel },
        );
        return m;
      }),
    );
  });
  app.delete("/files/:id", { preHandler: protect(app) }, async (req) => {
    const { id } = z.object({ id: z.string().max(100) }).parse(req.params);
    return ok(
      await transaction(async (tx) => {
        const removed = await tx.employeeFile.deleteMany({
          where: { id, ownerId: req.employee.id, kind: "MESSAGE" },
        });
        if (!removed.count)
          throw new AppError(
            404,
            "FILE_NOT_FOUND",
            "Only your own message attachments can be removed",
          );
        await audit(
          tx,
          req.employee.id,
          "MESSAGE_FILE_REMOVED",
          "EmployeeFile",
          id,
        );
        return { removed: true };
      }),
    );
  });
}
