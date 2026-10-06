import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addressErrors,
  assertTransition,
  money,
  paise,
  reconciliation,
} from "../src/modules/logistics/domain";
import { hasPermission } from "../src/shared/constants/permissions";
import { reviewRows } from "../src/modules/logistics/imports";
import { safeCell } from "../src/modules/logistics/reports";

test("transfer uses exact paise and subtracts material already shipped", () => {
  assert.deepEqual(
    reconciliation(paise("16000"), paise("1200"), paise("30000")),
    { credit: 1480000, deficit: 1520000, excess: 0 },
  );
  assert.equal(money(paise("0.10") + paise("0.20")), "0.30");
  assert.equal(reconciliation(500, 1000, 1000).credit, 0);
  assert.equal(reconciliation(5000, 0, 3000).excess, 2000);
  assert.throws(() => paise("1.009"));
});
test("tracking prohibits terminal transitions and delivery before handover", () => {
  assertTransition("QUEUED", "PACKED");
  assertTransition("FAILED_DELIVERY", "IN_TRANSIT");
  assert.throws(() => assertTransition("QUEUED", "DELIVERED"));
  assert.throws(() => assertTransition("RETURNED", "IN_TRANSIT"));
});
test("unverified postcode and missing identity block dispatch", () => {
  const s = {
    address: "12 College Road",
    mobile: "9876543210",
    pincode: "400001",
    city: "Mumbai",
    state: "Maharashtra",
  };
  assert.ok(addressErrors(s, null).length);
  assert.deepEqual(
    addressErrors(s, {
      serviceable: true,
      city: "Mumbai",
      state: "Maharashtra",
    }),
    [],
  );
  assert.ok(
    addressErrors(
      { ...s, mobile: "" },
      { serviceable: true, city: "Mumbai", state: "Delhi" },
    ).length >= 2,
  );
});
test("roles preserve department boundaries and employee administration", () => {
  assert.equal(hasPermission("WAREHOUSE_STAFF", "dispatch:write"), false);
  assert.equal(hasPermission("LOGISTICS_MANAGER", "employees:write"), false);
  assert.equal(hasPermission("DISPATCH_EXECUTIVE", "dispatch:approve"), false);
  assert.equal(hasPermission("VIEWER_AUDITOR", "students:read"), true);
  assert.equal(hasPermission("VIEWER_AUDITOR", "reports:export"), true);
  assert.equal(hasPermission("VIEWER_AUDITOR", "inventory:write"), false);
});
test("import detects titles, aliases, repeated headers and duplicates", () => {
  const rows = reviewRows(
    [
      [
        ["Pincode report"],
        ["Code", "City", "State", "Serviceable"],
        ["400001", "Mumbai", "Maharashtra", "yes"],
        ["Code", "City", "State", "Serviceable"],
        ["400001", "Mumbai", "Maharashtra", "yes"],
      ],
    ],
    "pincodes",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].errors.length, 0);
  assert.ok(rows[1].errors.includes("Duplicate row identity"));
});
test("spreadsheet exports neutralise formula cells", () => {
  assert.equal(safeCell("=1+1"), "'=1+1");
  assert.equal(safeCell("Book"), "Book");
});

test("text review preserves quoted fields and requires clear record boundaries", async () => {
  const { parseTextTable } = await import("shared-types");
  assert.deepEqual(
    parseTextTable(
      'City,Note\nMumbai,"Courier, reviewed"\nDelhi,"Line one\nLine two"',
      "delimited",
    ),
    [
      ["City", "Note"],
      ["Mumbai", "Courier, reviewed"],
      ["Delhi", "Line one\nLine two"],
    ],
  );
  assert.deepEqual(
    parseTextTable("Name: A; City: Mumbai\n\nName: B; City: Delhi", "keyvalue"),
    [
      ["Name", "City"],
      ["A", "Mumbai"],
      ["B", "Delhi"],
    ],
  );
  assert.throws(
    () => parseTextTable('Name,Note\nA,"unclosed', "delimited"),
    /Unclosed/,
  );
  assert.throws(
    () => parseTextTable("Unstructured prose without fields", "keyvalue"),
    /Key: value/,
  );
  assert.deepEqual(
    parseTextTable("Unstructured prose\nAnother line", "lines"),
    [["Source line"], ["Unstructured prose"], ["Another line"]],
  );
});
test("analysis filters combine conditions without coercing blanks or ambiguous dates", async () => {
  const { matchesFilters } = await import("shared-types");
  const filters = [
    { column: "Amount", operator: "gt" as const, value: "2000" },
    { column: "City", operator: "equals" as const, value: "Delhi" },
  ];
  assert.equal(
    matchesFilters(["2,400", "Delhi"], ["Amount", "City"], filters),
    true,
  );
  assert.equal(
    matchesFilters(["", "Delhi"], ["Amount", "City"], filters),
    false,
  );
  assert.equal(
    matchesFilters(["2400", "Mumbai"], ["Amount", "City"], filters),
    false,
  );
  assert.equal(
    matchesFilters(
      ["06/10/2026"],
      ["Date"],
      [{ column: "Date", operator: "after", value: "2026-01-01" }],
    ),
    false,
  );
});
test("column profiling excludes text and computes median and population deviation", async () => {
  const { columnProfile } = await import("shared-types");
  const profile = columnProfile(["3", "1", "2", "", "review"]);
  assert.equal(profile.type, "Mixed");
  assert.equal(profile.blank, 1);
  assert.equal(profile.numeric, 3);
  assert.equal(profile.mean, 2);
  assert.equal(profile.median, 2);
  assert.equal(profile.standardDeviation, Math.sqrt(2 / 3));
});
