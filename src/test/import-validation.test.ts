import { describe, expect, it } from "vitest";
import { IMPORT_TYPES, validateRows, autoMap } from "@/lib/import-validation";
import { marginPct, priceDropExposure } from "@/lib/format";

const pay = IMPORT_TYPES.customer_payments;
const map = autoMap(
  pay.fields.map((f) => f.key),
  pay.fields,
);

describe("spreadsheet validation", () => {
  it("rejects rows missing required fields", () => {
    const r = validateRows(
      [{ customer_code: "C001", payment_date: "2026-11-01", amount: "", reference: "X1" }],
      pay.fields,
      map,
      pay.dupKey,
    )[0]!;
    expect(r.errors).toContain("Amount (₹) is required");
  });
  it("rejects invalid dates", () => {
    const r = validateRows(
      [{ customer_code: "C001", payment_date: "2026-02-30", amount: "10", reference: "X1" }],
      pay.fields,
      map,
      pay.dupKey,
    )[0]!;
    expect(r.errors.some((e) => e.includes("valid YYYY-MM-DD"))).toBe(true);
  });
  it("rejects zero or negative amounts", () => {
    const r = validateRows(
      [{ customer_code: "C001", payment_date: "2026-11-01", amount: "-5", reference: "X1" }],
      pay.fields,
      map,
      pay.dupKey,
    )[0]!;
    expect(r.errors.some((e) => e.includes("at least"))).toBe(true);
  });
  it("flags duplicates within the file and against existing records", () => {
    const rows = [
      { customer_code: "C001", payment_date: "2026-11-01", amount: "10", reference: "A" },
      { customer_code: "C001", payment_date: "2026-11-01", amount: "10", reference: "a" },
      { customer_code: "C002", payment_date: "2026-11-01", amount: "10", reference: "OLD" },
    ];
    const res = validateRows(rows, pay.fields, map, pay.dupKey, new Set(["old"]));
    expect(res.map((r) => r.duplicate)).toEqual([false, true, true]);
  });
  it("parses rupee-formatted numbers", () => {
    const r = validateRows(
      [
        {
          customer_code: "C001",
          payment_date: "2026-11-01",
          amount: "₹1,25,000",
          reference: "Z",
          invoice_no: "INV-100",
        },
      ],
      pay.fields,
      map,
      pay.dupKey,
    )[0]!;
    expect(r.errors).toEqual([]);
    expect(r.values["amount"]).toBe("125000");
  });
});

describe("pricing maths", () => {
  it("gross margin is (price - cost) / price", () => {
    expect(marginPct(50, 40)).toBeCloseTo(20);
  });
  it("₹2/kg drop on 1,000 kg exposes ₹2,000", () => {
    expect(priceDropExposure(1000, 2)).toBe(2000);
  });
});
