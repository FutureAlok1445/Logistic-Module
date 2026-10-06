import { z } from "zod";

const text = z.string().trim().min(1).max(500);
export const id = z.string().trim().min(1).max(100);
const amount = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine(
    (v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100000000,
    "Use positive money with at most two decimals",
  );
const qty = z.coerce.number().int().min(1).max(1000000);
export const line = z.object({ itemId: id, quantity: qty });
export const masterSchemas = {
  centers: z.object({ name: text, code: id, city: text, state: text }),
  courses: z.object({ name: text, code: id, fee: amount }),
  prices: z.object({ courseId: id, centerId: id, fee: amount }),
  items: z.object({
    sku: id,
    name: text,
    pages: z.coerce.number().int().min(0).max(10000).default(0),
    unitCost: amount,
    lowStockThreshold: z.coerce.number().int().min(0).default(10),
  }),
  couriers: z.object({
    name: text,
    trackingUrl: z
      .string()
      .url()
      .startsWith("https://")
      .optional()
      .or(z.literal("")),
  }),
  rules: z.object({ courierPartnerId: id, state: text, priority: qty }),
  pincodes: z.object({
    code: z.string().regex(/^[1-9]\d{5}$/),
    city: text,
    state: text,
    serviceable: z.boolean().default(true),
  }),
  templates: z.object({
    event: z.enum([
      "PACKED",
      "HANDED_TO_COURIER",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "FAILED_DELIVERY",
      "TRANSFER_CONFIRMED",
    ]),
    channel: z.enum(["SMS", "WHATSAPP"]),
    content: text,
    enabled: z.boolean().default(true),
  }),
};
export const kitSchema = z.object({
  name: text,
  description: z.string().max(1000).optional(),
  courseId: id,
  milestoneNumber: qty.max(20),
  weightKg: z.coerce.number().min(0.001).max(1000),
  items: z.array(line).min(1).max(100),
});
export const stockSchema = z.object({
  itemId: id,
  centerId: id,
  quantity: z.coerce
    .number()
    .int()
    .min(-1000000)
    .max(1000000)
    .refine((n) => n !== 0),
  reason: text.min(5),
});
export const dispatchSchema = z.object({
  ids: z.array(id).min(1).max(1000),
  status: z.enum([
    "QUEUED",
    "PACKED",
    "HOLD",
    "HANDED_TO_COURIER",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "FAILED_DELIVERY",
    "RTO_INITIATED",
  ]),
  deliveryMode: z
    .enum(["COURIER", "SPEED_POST", "IN_PERSON", "CENTER_TO_CENTER"])
    .optional(),
  warehouseId: id.optional(),
  awbNumber: id.optional(),
  courierPartnerId: id.optional(),
  reason: z.string().trim().max(500).optional(),
  location: z.string().max(200).optional(),
  expectedDelivery: z.iso.datetime().optional(),
  expectedDispatch: z.iso.datetime().optional(),
});
export const transferSchema = z.object({
  studentId: id,
  toCourseId: id,
  toCenterId: id,
  reason: text.min(5),
});
export const approvalSchema = z.object({
  approved: z.boolean(),
  resolution: z.enum([
    "CREDIT_ADJUSTMENT",
    "FLAG_FINANCE",
    "REQUEST_RETURN",
    "DEDUCT_MATERIAL_COST",
  ]),
  reason: text.min(5),
});
export const orderSchema = z
  .object({
    fromCenterId: id,
    toCenterId: id,
    reason: text.min(5),
    boxes: qty.default(1),
    lines: z.array(line).min(1).max(100),
  })
  .refine((v) => v.fromCenterId !== v.toCenterId, "Choose different centres");
export const receiptSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: id,
        quantity: z.coerce.number().int().min(0).max(1000000),
        damaged: z.coerce.number().int().min(0).default(0),
      }),
    )
    .min(1)
    .max(100),
});
export const requisitionSchema = z.object({
  centerId: id,
  vendor: text,
  lines: z.array(line).min(1).max(200),
});
export const studentSchema = z.object({
  id,
  name: text,
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email().optional().nullable(),
  address: text,
  city: text,
  state: text,
  pincode: z.string().regex(/^[1-9]\d{5}$/),
  courseId: id,
  centerId: id,
  batchId: id.optional(),
  enrollmentDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "HOLD", "DROPPED", "COMPLETED", "TRANSFERRED"]),
  paymentPlanId: id,
  notes: z.string().max(2000).optional(),
});
export const paymentSchema = z.object({
  studentId: id,
  milestoneNumber: qty.max(20),
  amount,
  paid: z.boolean(),
  paidAt: z.coerce.date().nullable().optional(),
});
export const employeeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: text,
  role: z.enum([
    "SUPER_ADMIN",
    "LOGISTICS_MANAGER",
    "DISPATCH_EXECUTIVE",
    "WAREHOUSE_STAFF",
    "VIEWER_AUDITOR",
  ]),
  password: z.string().min(12).max(128),
});
