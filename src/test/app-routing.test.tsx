import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV } from "@/lib/nav";
import {
  grossProfit,
  grossProfitPerKg,
  grossMargin,
  landedCost,
  calculateLandedCost,
  outstanding,
  overdueAmount,
  creditUtilisation,
} from "@/lib/financial";
import { rulePlan } from "@/lib/assistant-schema";
import { answerBusiness } from "@/lib/assistant-engine";
import { getDemonstrationData } from "@/lib/demo-data";

describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("has exactly the seven required navigation modules", () => {
    const paths = NAV.map((n) => n.to);
    expect(paths).toEqual([
      "/customers",
      "/customer-management",
      "/credit",
      "/pricing",
      "/assistant",
      "/data-centre",
      "/settings",
    ]);
  });

  it("matches every navigation route in the route tree", () => {
    for (const item of NAV) {
      const matches = router.matchRoutes(item.to);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });
});

describe("Financial module formulas", () => {
  it("calculates gross profit correctly", () => {
    expect(grossProfit(100000, 80000)).toBe(20000);
    expect(grossProfitPerKg(50, 42)).toBe(8);
  });

  it("calculates gross margin percentage correctly", () => {
    expect(grossMargin(100, 80)).toBeCloseTo(20);
    expect(grossMargin(0, 0)).toBe(0);
  });

  it("calculates landed cost correctly with freight and overheads", () => {
    expect(landedCost(40, 2, 0.5)).toBe(42.5);
    expect(landedCost(35)).toBe(35);
  });

  it("calculates landed cost, gross profit, and margin based on unit cost, freight, and tax fields", () => {
    // ₹40 unit cost + ₹1.50 freight + 5% tax (₹2.00) = ₹43.50
    expect(calculateLandedCost(40, 1.5, 5)).toBe(43.5);
    // ₹50 unit cost + ₹2 freight + 0% tax = ₹52
    expect(calculateLandedCost(50, 2, 0)).toBe(52);
    // Gross profit and margin from calculated landed cost
    const cost = calculateLandedCost(40, 1.5, 5); // 43.5
    const sellingPrice = 50;
    expect(grossProfitPerKg(sellingPrice, cost)).toBe(6.5);
    expect(grossMargin(sellingPrice, cost)).toBeCloseTo(13);
  });

  it("calculates outstanding balances strictly from sales and allocated payments", () => {
    expect(outstanding(50000, 30000)).toBe(20000);
    expect(outstanding(50000, 60000)).toBe(0);
  });

  it("calculates overdue amounts only when past due date", () => {
    const asOf = "2026-11-05";
    expect(overdueAmount(10000, "2026-11-01", asOf)).toBe(10000);
    expect(overdueAmount(10000, "2026-11-10", asOf)).toBe(0);
    expect(overdueAmount(10000, null, asOf)).toBe(0);
  });

  it("calculates credit utilisation percentage", () => {
    expect(creditUtilisation(50000, 100000)).toBe(50);
    expect(creditUtilisation(50000, 0)).toBeNull();
  });
});

describe("AI Business Assistant demonstration analytics", () => {
  const today = "2026-11-05";
  const db = getDemonstrationData(today);

  it("answers customer profitability with verified figures from demonstration records", () => {
    const plan = rulePlan("Which customers generate the highest gross profit?", today);
    const answer = answerBusiness(plan, db, today, "demo");
    expect(answer.status).toBe("ok");
    expect(answer.rows.length).toBe(12);
    expect(answer.summary).toContain("leads with gross profit of");
  });

  it("answers overdue payments based on actual credit invoices and payments", () => {
    const plan = rulePlan("Which customers have overdue payments?", today);
    const answer = answerBusiness(plan, db, today, "demo");
    expect(answer.status).toBe("ok");
    expect(answer.summary).toContain("overdue:");
    expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("calculates inventory exposure for price drop queries", () => {
    const plan = rulePlan("What happens if sugar prices fall by ₹2 per kg?", today);
    const answer = answerBusiness(plan, db, today, "demo");
    expect(answer.status).toBe("ok");
    expect(answer.summary).toContain("estimated exposure is ₹34,700.00");
    expect(answer.rows.length).toBe(7); // across all 7 godowns
  });

  it("detects customer prices agreed below recorded landed cost", () => {
    const plan = rulePlan("Which customers receive prices below our landed cost?", today);
    const answer = answerBusiness(plan, db, today, "demo");
    expect(answer.status).toBe("ok");
    expect(answer.rows.length).toBe(1);
    expect(answer.rows[0]?.[0]).toBe("Jiaganj Traders");
  });
});
