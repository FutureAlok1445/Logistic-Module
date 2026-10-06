import { BusinessRuleError } from "../../shared/errors";

export const transitions: Record<string, string[]> = {
  QUEUED: ["PACKED", "HOLD"],
  ADDRESS_FLAGGED: ["QUEUED", "HOLD"],
  HOLD: ["QUEUED", "PACKED"],
  PACKED: ["HANDED_TO_COURIER", "HOLD"],
  HANDED_TO_COURIER: ["IN_TRANSIT", "FAILED_DELIVERY"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["IN_TRANSIT", "RTO_INITIATED"],
  RTO_INITIATED: ["RETURNED"],
  DELIVERED: ["RTO_INITIATED"],
  RETURNED: [],
};

export function assertTransition(from: string, to: string) {
  if (!transitions[from]?.includes(to))
    throw new BusinessRuleError(
      "INVALID_TRANSITION",
      `Cannot move ${from} to ${to}`,
    );
}

export function paise(value: unknown): number {
  const s = String(value);
  if (!/^-?\d+(\.\d{1,2})?$/.test(s))
    throw new BusinessRuleError(
      "INVALID_MONEY",
      "Money must have at most two decimal places",
    );
  const negative = s.startsWith("-");
  const [whole, fraction = ""] = s.replace("-", "").split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n))
    throw new BusinessRuleError(
      "INVALID_MONEY",
      "Money exceeds supported range",
    );
  return negative ? -n : n;
}

export const money = (n: number) => (n / 100).toFixed(2);

export function reconciliation(paid: number, materials: number, fee: number) {
  const credit = Math.max(0, paid - materials);
  return {
    credit,
    deficit: Math.max(0, fee - credit),
    excess: Math.max(0, credit - fee),
  };
}

export function addressErrors(
  student: {
    address: string;
    mobile: string;
    pincode: string;
    city: string;
    state: string;
  },
  postcode?: { serviceable: boolean; state: string; city: string } | null,
) {
  const errors: string[] = [];
  if (student.address.trim().length < 8 || !student.city || !student.state)
    errors.push("Incomplete address");
  if (!/^[6-9]\d{9}$/.test(student.mobile))
    errors.push("Valid Indian mobile required");
  if (!/^[1-9]\d{5}$/.test(student.pincode)) errors.push("Invalid pincode");
  if (!postcode?.serviceable)
    errors.push("Pincode not verified as serviceable");
  if (postcode && postcode.state.toLowerCase() !== student.state.toLowerCase())
    errors.push("State does not match pincode");
  return errors;
}
