import { grossMargin, estimatedExposure } from "./financial";
const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const inr = (n: number | null | undefined) => inrFmt.format(Number(n ?? 0));
export const inrP = (n: number | null | undefined) => inr2.format(Number(n ?? 0));
export const num = (n: number | null | undefined) => numFmt.format(Number(n ?? 0));

/** Compact Indian notation: ₹12.4 L, ₹1.2 Cr */
export function inrCompact(n: number | null | undefined) {
  const v = Number(n ?? 0);
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)} K`;
  return inr(v);
}

export const pct = (n: number | null | undefined, digits = 1) =>
  `${Number(n ?? 0).toFixed(digits)}%`;

/** Gross margin % = (price - cost) / price */
export function marginPct(price: number, cost: number) {
  return grossMargin(price, cost);
}

/** Inventory exposure when market falls by `dropPerKg` */
export function priceDropExposure(quantityKg: number, dropPerKg: number) {
  return estimatedExposure(quantityKg, dropPerKg);
}
