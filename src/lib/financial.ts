export function grossProfit(revenue: number, cogs: number) {
  return revenue - cogs;
}
export function grossProfitPerKg(sellingPrice: number, landedCost: number) {
  return sellingPrice - landedCost;
}
export function grossMargin(revenue: number, cogs: number) {
  return revenue === 0 ? 0 : (grossProfit(revenue, cogs) / revenue) * 100;
}
export function landedCost(baseCost: number, freightPerKg = 0, otherPerKg = 0) {
  return baseCost + freightPerKg + otherPerKg;
}
export function calculateLandedCost(unitCost: number, freightPerKg = 0, taxPct = 0, taxPerKg = 0) {
  const taxFromRate = (Math.max(0, unitCost) * Math.max(0, taxPct)) / 100;
  return Math.max(0, unitCost) + Math.max(0, freightPerKg) + taxFromRate + Math.max(0, taxPerKg);
}
export function outstanding(creditSales: number, allocatedPayments: number) {
  return Math.max(0, creditSales - allocatedPayments);
}
export function overdueAmount(unpaid: number, dueDate: string | null, asOf: string) {
  return dueDate && dueDate < asOf ? Math.max(0, unpaid) : 0;
}
export function creditUtilisation(balance: number, limit: number) {
  return limit > 0 ? (balance / limit) * 100 : null;
}
export function estimatedExposure(quantityKg: number, decline: number) {
  return Math.max(0, quantityKg) * Math.max(0, decline);
}
