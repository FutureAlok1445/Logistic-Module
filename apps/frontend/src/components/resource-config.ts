import type { Field, FormSpec } from "./forms";
export interface ResourceConfig {
  title: string;
  description: string;
  permission: string;
  columns: {
    label: string;
    path: string;
    type?: "money" | "date" | "status" | "bool";
  }[];
  statuses?: string[];
  report?: string;
  create?: {
    permission: string;
    title: string;
    endpoint: string;
    fields: Field[];
  };
}
const col = (
  label: string,
  path: string,
  type?: "money" | "date" | "status" | "bool",
) => ({ label, path, type });
const field = (
  name: string,
  label: string,
  type: Field["type"] = "text",
  required = true,
): Field => ({ name, label, type, required });
const select = (name: string, label: string): Field =>
  field(name, label, "select");
export const config: Record<string, ResourceConfig> = {
  students: {
    title: "Students",
    description:
      "Enrolment, payment readiness and shipment history from Admissions and Finance.",
    permission: "students:read",
    columns: [
      col("Student", "name"),
      col("Student ID", "id"),
      col("Course", "course.name"),
      col("Centre", "center.name"),
      col("City", "city"),
      col("Pincode", "pincode"),
      col("Mobile", "mobile"),
      col("Readiness", "readiness", "status"),
      col("Payment", "paymentState", "status"),
      col("Amount paid", "paidAmount", "money"),
      col("Status", "status", "status"),
      col("Enrolled", "enrollmentDate", "date"),
    ],
    statuses: ["ACTIVE", "HOLD", "DROPPED", "COMPLETED", "TRANSFERRED"],
  },
  dispatches: {
    title: "Dispatch desk",
    description:
      "Verified payments. Prepared kits. Every handover accounted for.",
    permission: "dispatch:read",
    columns: [
      col("Student", "student.name"),
      col("Student ID", "studentId"),
      col("Kit", "kit.name"),
      col("Destination", "student.city"),
      col("Pincode", "student.pincode"),
      col("Courier", "courierPartner.name"),
      col("AWB", "awbNumber"),
      col("Status", "status", "status"),
      col("Created", "createdAt", "date"),
    ],
    statuses: [
      "QUEUED",
      "ADDRESS_FLAGGED",
      "HOLD",
      "PACKED",
      "HANDED_TO_COURIER",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "FAILED_DELIVERY",
      "RTO_INITIATED",
      "RETURNED",
    ],
    report: "dispatch",
  },
  inventory: {
    title: "Warehouse stock",
    description: "Usable and damaged material balances across every centre.",
    permission: "inventory:read",
    columns: [
      col("Material", "item.name"),
      col("SKU", "item.sku"),
      col("Location", "center.name"),
      col("Available", "quantity"),
      col("Damaged", "damaged"),
      col("Low-stock threshold", "item.lowStockThreshold"),
      col("Updated", "updatedAt", "date"),
    ],
    report: "inventory",
    create: {
      permission: "inventory:write",
      title: "Receive or adjust stock",
      endpoint: "/inventory/adjust",
      fields: [
        select("itemId", "Material"),
        select("centerId", "Location"),
        field("quantity", "Quantity change", "number"),
        field("reason", "Receipt or adjustment reason", "textarea"),
      ],
    },
  },
  ledger: {
    title: "Stock ledger",
    description: "Every inward, outward and adjustment with a reason.",
    permission: "inventory:read",
    columns: [
      col("Material", "item.name"),
      col("Centre ID", "centerId"),
      col("Usable change", "quantity"),
      col("Damaged change", "damaged"),
      col("Reason", "reason"),
      col("Reference", "reference"),
      col("Recorded", "createdAt", "date"),
    ],
  },
  kits: {
    title: "Kit composition",
    description:
      "Course-specific material bundles unlocked by payment milestones.",
    permission: "inventory:read",
    columns: [
      col("Kit", "name"),
      col("Course", "course.name"),
      col("Milestone", "milestoneNumber"),
      col("Weight (kg)", "weightKg"),
      col("Description", "description"),
    ],
    create: {
      permission: "config:write",
      title: "Define kit",
      endpoint: "/kits",
      fields: [
        field("name", "Kit name"),
        select("courseId", "Course"),
        {
          ...field("milestoneNumber", "Payment milestone", "number"),
          min: 1,
          max: 20,
        },
        { ...field("weightKg", "Weight (kg)", "number"), min: 0.01 },
        field("description", "Description", "textarea", false),
        field("items", "Bill of materials", "lines"),
      ],
    },
  },
  items: {
    title: "Material catalogue",
    description: "Books, practice sheets and supplies used in kit composition.",
    permission: "inventory:read",
    columns: [
      col("Material", "name"),
      col("SKU", "sku"),
      col("Pages", "pages"),
      col("Unit cost", "unitCost", "money"),
      col("Low-stock threshold", "lowStockThreshold"),
    ],
    create: {
      permission: "config:write",
      title: "Add material",
      endpoint: "/master/items",
      fields: [
        field("name", "Material name"),
        field("sku", "SKU"),
        { ...field("pages", "Pages", "number"), min: 0 },
        { ...field("unitCost", "Unit cost (INR)", "number"), min: 0 },
        {
          ...field("lowStockThreshold", "Low-stock threshold", "number"),
          min: 0,
        },
      ],
    },
  },
  transfers: {
    title: "Course transfers",
    description:
      "Pause old shipments, reconcile material costs and approve the next step.",
    permission: "transfers:read",
    columns: [
      col("Student", "student.name"),
      col("Paid", "amountPaid", "money"),
      col("Shipped materials", "materialCost", "money"),
      col("Usable credit", "usableCredit", "money"),
      col("Target fee", "targetFee", "money"),
      col("Balance / excess", "balance", "money"),
      col("Status", "status", "status"),
    ],
    statuses: ["PENDING", "APPROVED_AWAITING_SYNC", "COMPLETED", "REJECTED"],
    report: "transfer",
    create: {
      permission: "transfers:write",
      title: "Request transfer",
      endpoint: "/transfers",
      fields: [
        field("studentId", "Student ID"),
        select("toCourseId", "New course"),
        select("toCenterId", "New centre"),
        field("reason", "Transfer reason", "textarea"),
      ],
    },
  },
  returns: {
    title: "Returns & RTO",
    description: "Reconcile returned parcels by condition. Restore stock once.",
    permission: "dispatch:read",
    columns: [
      col("Student", "dispatch.student.name"),
      col("Kit", "dispatch.kit.name"),
      col("Reason", "reason"),
      col("Condition", "condition"),
      col("Status", "status", "status"),
      col("Received", "receivedAt", "date"),
    ],
    statuses: ["REQUESTED", "RECEIVED"],
    create: {
      permission: "dispatch:write",
      title: "Request material return",
      endpoint: "/returns",
      fields: [
        field("dispatchId", "Dispatch ID"),
        field("reason", "Return reason", "textarea"),
      ],
    },
  },
  orders: {
    title: "Centre movements",
    description:
      "Track bulk stock from warehouse outward to confirmed centre inward.",
    permission: "b2b:read",
    columns: [
      col("Order", "id"),
      col("From centre", "fromCenterId"),
      col("To centre", "toCenterId"),
      col("Boxes", "boxes"),
      col("Tracking", "awbNumber"),
      col("Status", "status", "status"),
      col("Created", "createdAt", "date"),
    ],
    create: {
      permission: "b2b:write",
      title: "Create centre request",
      endpoint: "/orders",
      fields: [
        select("fromCenterId", "From centre"),
        select("toCenterId", "Receiving centre"),
        { ...field("boxes", "Box count", "number"), min: 1 },
        field("reason", "Request reason", "textarea"),
        field("lines", "Requested materials", "lines"),
      ],
    },
  },
  requisitions: {
    title: "Print requisitions",
    description: "Material demand, vendor orders and verified goods received.",
    permission: "print:read",
    columns: [
      col("Requisition", "id"),
      col("Vendor", "vendor"),
      col("Receiving centre", "centerId"),
      col("Status", "status", "status"),
      col("Ordered", "createdAt", "date"),
    ],
    report: "print",
    create: {
      permission: "print:write",
      title: "Order printed materials",
      endpoint: "/requisitions",
      fields: [
        field("vendor", "Vendor"),
        select("centerId", "Receiving centre"),
        field("lines", "Order quantities", "lines"),
      ],
    },
  },
  notifications: {
    title: "Student notifications",
    description: "Message delivery, configuration gaps and retryable failures.",
    permission: "notifications:read",
    columns: [
      col("Student", "student.name"),
      col("Event", "type"),
      col("Channel", "channel"),
      col("Message", "content"),
      col("Status", "status", "status"),
      col("Attempts", "attempts"),
      col("Last issue", "error"),
      col("Created", "timestamp", "date"),
    ],
    statuses: ["PENDING", "WAITING_CONFIGURATION", "SENDING", "SENT", "FAILED"],
  },
  audit: {
    title: "Audit trail",
    description:
      "Immutable records of employee actions and provider ingestion.",
    permission: "audit:read",
    columns: [
      col("Employee", "employee.fullName"),
      col("Action", "action"),
      col("Entity", "entity"),
      col("Record", "entityId"),
      col("Recorded", "timestamp", "date"),
    ],
    report: "audit",
  },
  employees: {
    title: "Employee access",
    description:
      "Invite internal colleagues and assign only the access they need.",
    permission: "employees:read",
    columns: [
      col("Employee", "fullName"),
      col("Email", "email"),
      col("Role", "role"),
      col("Active", "isActive", "bool"),
      col("Added", "createdAt", "date"),
    ],
    create: {
      permission: "employees:write",
      title: "Create employee",
      endpoint: "/employees",
      fields: [
        field("fullName", "Full name"),
        field("email", "Email", "email"),
        {
          ...select("role", "Role"),
          options: [
            "SUPER_ADMIN",
            "LOGISTICS_MANAGER",
            "DISPATCH_EXECUTIVE",
            "WAREHOUSE_STAFF",
            "VIEWER_AUDITOR",
          ].map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
        },
        {
          ...field("password", "Initial password", "password"),
          hint: "At least 12 characters. Share privately.",
        },
      ],
    },
  },
  centers: {
    title: "Centres & warehouses",
    description: "Physical stock locations and delivery destinations.",
    permission: "config:read",
    columns: [
      col("Centre", "name"),
      col("Code", "code"),
      col("City", "city"),
      col("State", "state"),
    ],
    create: {
      permission: "config:write",
      title: "Add centre",
      endpoint: "/master/centers",
      fields: [
        field("name", "Centre name"),
        field("code", "Centre code"),
        field("city", "City"),
        field("state", "State"),
      ],
    },
  },
  courses: {
    title: "Courses",
    description:
      "Authoritative course fees synchronised from Finance. Employees cannot edit fees.",
    permission: "config:read",
    columns: [
      col("Course", "name"),
      col("Code", "code"),
      col("Finance fee", "fee", "money"),
      col("Course ID", "id"),
    ],
  },
  prices: {
    title: "Regional course prices",
    description: "Centre-specific pricing supplied by Finance.",
    permission: "payments:read",
    columns: [
      col("Course", "course.name"),
      col("Centre", "center.name"),
      col("Fee", "fee", "money"),
    ],
  },
  couriers: {
    title: "Courier partners",
    description: "Approved delivery partners with secure tracking links.",
    permission: "couriers:read",
    columns: [col("Partner", "name"), col("Tracking URL", "trackingUrl")],
    create: {
      permission: "config:write",
      title: "Add courier partner",
      endpoint: "/master/couriers",
      fields: [
        field("name", "Partner name"),
        field("trackingUrl", "HTTPS tracking URL", "text", false),
      ],
    },
  },
  rules: {
    title: "Courier routing",
    description:
      "Match destination state to partner. Lowest priority number wins.",
    permission: "couriers:read",
    columns: [
      col("State", "state"),
      col("Courier", "courier.name"),
      col("Priority", "priority"),
    ],
    create: {
      permission: "config:write",
      title: "Add routing rule",
      endpoint: "/master/rules",
      fields: [
        field("state", "Destination state"),
        select("courierPartnerId", "Courier"),
        { ...field("priority", "Priority", "number"), min: 1 },
      ],
    },
  },
  pincodes: {
    title: "Delivery serviceability",
    description:
      "Verified India Post locations and contracted courier coverage.",
    permission: "config:read",
    columns: [
      col("Pincode", "code"),
      col("City", "city"),
      col("State", "state"),
      col("Serviceable", "serviceable", "bool"),
    ],
    create: {
      permission: "config:write",
      title: "Save verified pincode",
      endpoint: "/master/pincodes",
      fields: [
        field("code", "Six-digit pincode"),
        field("city", "City"),
        field("state", "State"),
        field("serviceable", "Courier serviceable", "checkbox", false),
      ],
    },
  },
  templates: {
    title: "Message templates",
    description:
      "Use [Name], [Course], [Kit], [Courier], [AWB] and [Date] in event messages.",
    permission: "notifications:read",
    columns: [
      col("Event", "event"),
      col("Channel", "channel"),
      col("Template", "content"),
      col("Enabled", "enabled", "bool"),
    ],
    create: {
      permission: "notifications:templates:write",
      title: "Save message template",
      endpoint: "/master/templates",
      fields: [
        {
          ...select("event", "Event"),
          options: [
            "PACKED",
            "HANDED_TO_COURIER",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "FAILED_DELIVERY",
            "TRANSFER_CONFIRMED",
          ].map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
        },
        {
          ...select("channel", "Channel"),
          options: [
            { value: "SMS", label: "SMS" },
            { value: "WHATSAPP", label: "WhatsApp" },
          ],
        },
        field("content", "Message content", "textarea"),
        field("enabled", "Enabled", "checkbox", false),
      ],
    },
  },
};
export const steps: Record<string, string[]> = {
  QUEUED: ["PACKED", "HOLD"],
  ADDRESS_FLAGGED: ["QUEUED", "HOLD"],
  HOLD: ["QUEUED", "PACKED"],
  PACKED: ["HANDED_TO_COURIER", "HOLD"],
  HANDED_TO_COURIER: ["IN_TRANSIT", "FAILED_DELIVERY"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["IN_TRANSIT", "RTO_INITIATED"],
  DELIVERED: ["RTO_INITIATED"],
  RTO_INITIATED: [],
  RETURNED: [],
};
export function initialDefaults(fields: Field[]): FormSpec["initial"] {
  return Object.fromEntries(
    fields
      .filter((f) => f.type === "checkbox" || f.type === "number")
      .map((f) => [
        f.name,
        f.type === "checkbox"
          ? true
          : (f.min ??
            (["quantity", "milestoneNumber", "boxes", "priority"].includes(
              f.name,
            )
              ? 1
              : 0)),
      ]),
  );
}
