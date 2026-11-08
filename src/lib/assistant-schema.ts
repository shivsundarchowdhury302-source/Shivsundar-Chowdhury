import { z } from "zod";

export const intents = [
  "customer_profit",
  "customer_decline",
  "outstanding",
  "overdue",
  "credit_limits",
  "ageing",
  "product_profit",
  "product_margin",
  "best_selling",
  "product_compare",
  "below_cost",
  "price_history",
  "market_compare",
  "supplier_purchases",
  "expense_summary",
  "net_performance",
  "inventory",
  "exposure",
  "unsupported",
] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Enter a valid calendar date.");
export const planSchema = z
  .object({
    intent: z.enum(intents),
    from: date.nullable(),
    to: date.nullable(),
    product: z.string().max(120).nullable(),
    customer: z.string().max(120).nullable(),
    drop: z.number().min(0).max(100000).nullable(),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const requestSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    source: z.enum(["real", "demo"]),
    previousQuestion: z.string().max(1000).optional(),
  })
  .strict();

export function checkPeriod(plan: Plan, today: string) {
  const to = plan.to ?? today;
  const from =
    plan.from ??
    new Date(new Date(`${to}T00:00:00Z`).getTime() - 89 * 86400000).toISOString().slice(0, 10);
  date.parse(from);
  date.parse(to);
  if (from > to) throw new Error("The start date must be on or before the end date.");
  if (to > today)
    throw new Error("Future dates are not supported. Choose a period ending today or earlier.");
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 3660)
    throw new Error("Choose a period of ten years or less.");
  return { from, to };
}

export function rulePlan(question: string, today: string): Plan {
  const q = question.toLowerCase();
  let intent: Plan["intent"] = "unsupported";
  if (/below.*cost|cost.*above.*price/.test(q)) intent = "below_cost";
  else if (/competitor|market rate|market price|benchmark price|compare.*market/.test(q))
    intent = "market_compare";
  else if (
    /supplier procurement|spent on purchasing|supplier|purchase from|vendor|procurement/.test(q)
  )
    intent = "supplier_purchases";
  else if (/net profit|net performance|bottom line|overall business|profit after expense/.test(q))
    intent = "net_performance";
  else if (/operating expense|expense.*category|total expense|overhead|expenditure/.test(q))
    intent = "expense_summary";
  else if (
    /inventory risk|financial exposure|price.*(fall|fell|drop|declin)|inventory exposure|high.*exposure/.test(
      q,
    )
  )
    intent = "exposure";
  else if (/stock|inventory|godown/.test(q)) intent = "inventory";
  else if (
    /price history|historical|price movements|changed over time|selling prices.*changed/.test(q)
  )
    intent = "price_history";
  else if (/ageing|aging/.test(q)) intent = "ageing";
  else if (/crossed|exceed|credit limit/.test(q)) intent = "credit_limits";
  else if (/overdue/.test(q)) intent = "overdue";
  else if (/outstanding|unpaid|receivable/.test(q)) intent = "outstanding";
  else if (/reduced|declining|purchases.*fall/.test(q)) intent = "customer_decline";
  else if (
    /product performance|compar.*product|product.*compar|profitability.*period|increase or decrease in sales|increase.*decrease.*sales/.test(
      q,
    )
  )
    intent = "product_compare";
  else if (/best.sell|most.sell|selling products/.test(q)) intent = "best_selling";
  else if (/product.*(lowest|low).*margin|lowest margins/.test(q)) intent = "product_margin";
  else if (/product.*profit/.test(q)) intent = "product_profit";
  else if (/customer.*(profit|valuable)|valuable customers/.test(q)) intent = "customer_profit";
  const dates = q.match(/\d{4}-\d{2}-\d{2}/g);
  let from: string | null = dates?.[0] ?? null;
  let to: string | null = dates?.[1] ?? (from ? from : null);
  if (!dates && /compared with (?:the )?(?:previous|last) month/.test(q)) {
    from = today.slice(0, 8) + "01";
    to = today;
  } else if (!dates && /this month/.test(q)) {
    from = today.slice(0, 8) + "01";
    to = today;
  } else if (!dates && /(?:last|previous)\s+month/.test(q)) {
    const end = new Date(`${today.slice(0, 8)}01T00:00:00Z`);
    end.setUTCDate(0);
    to = end.toISOString().slice(0, 10);
    from = to.slice(0, 8) + "01";
  }
  const days = q.match(/(?:last|past)\s+(\d+)\s+days/);
  if (days) {
    to = today;
    from = new Date(Date.parse(today) - (Number(days[1]) - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const drop = q.match(/(?:₹|rs\.?|by)\s*(\d+(?:\.\d+)?)/);
  return planSchema.parse({
    intent,
    from,
    to,
    product: /sugar/.test(q) ? "sugar" : null,
    customer: null,
    drop: drop ? Number(drop[1]) : null,
  });
}
