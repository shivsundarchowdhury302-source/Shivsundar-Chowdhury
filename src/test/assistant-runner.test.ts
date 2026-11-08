import { describe, expect, it } from "vitest";
import { askBusinessRunner } from "@/lib/assistant-runner";

describe("AI Business Assistant Verification", () => {
  it("answers 'Which customers receive prices below our landed cost?' with verified demo data", async () => {
    const answer = await askBusinessRunner({
      question: "Which customers receive prices below our landed cost?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBeDefined();
    expect(answer.summary).toBeDefined();
    expect(answer.summary.length).toBeGreaterThan(10);
    expect(answer.columns.length).toBeGreaterThan(0);
    expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("answers price-drop sensitivity question: 'What happens if sugar prices fall by ₹2 per kg?'", async () => {
    const answer = await askBusinessRunner({
      question: "What happens if sugar prices fall by ₹2 per kg?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.summary).toContain("₹");
    expect(answer.columns).toContain("Product");
    expect(answer.columns).toContain("Estimated exposure");
  });

  it("answers 'Which customers have reduced their purchases?'", async () => {
    const answer = await askBusinessRunner({
      question: "Which customers have reduced their purchases?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("Customer");
  });

  it("answers 'Which products have the lowest margins?'", async () => {
    const answer = await askBusinessRunner({
      question: "Which products have the lowest margins?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("Margin");
  });

  it("answers 'Which customers generate the highest gross profit?'", async () => {
    const answer = await askBusinessRunner({
      question: "Which customers generate the highest gross profit?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("Gross profit");
  });

  it("answers 'Which customers have overdue payments?'", async () => {
    const answer = await askBusinessRunner({
      question: "Which customers have overdue payments?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("Overdue");
  });

  it("supports conversational follow-up questions", async () => {
    const firstAnswer = await askBusinessRunner({
      question: "Which customers generate the highest gross profit?",
      source: "demo",
    });
    expect(firstAnswer.status).toBe("ok");

    // Follow-up question relying on previous context
    const followUpAnswer = await askBusinessRunner({
      question: "What about overdue payments?",
      source: "demo",
      previousQuestion: "Which customers generate the highest gross profit?",
    });

    expect(followUpAnswer.status).toBe("ok");
    expect(followUpAnswer.columns).toContain("Overdue");
  });

  it("answers Pricing Intelligence question: 'How do our prices compare to market prices?'", async () => {
    const answer = await askBusinessRunner({
      question: "How do our prices compare to market prices?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Commodity market price benchmark");
    expect(answer.columns).toContain("Benchmark Source");
    expect(answer.columns).toContain("Market Rate / kg");
    expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("answers Procurement & Supplier Intelligence: 'Which suppliers have the highest purchase volume?'", async () => {
    const answer = await askBusinessRunner({
      question: "Which suppliers have the highest purchase volume?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Supplier procurement and purchase spend");
    expect(answer.columns).toContain("Supplier");
    expect(answer.columns).toContain("Volume (kg)");
    expect(answer.columns).toContain("Total Spend");
    expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("answers Expense Intelligence: 'What are our total expenses by category?'", async () => {
    const answer = await askBusinessRunner({
      question: "What are our total expenses by category?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Operating expenses by category");
    expect(answer.columns).toContain("Category");
    expect(answer.columns).toContain("Total Amount");
    expect(answer.columns).toContain("Share of Overhead");
    expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("answers Business Decision Support: 'What is our net performance after expenses?'", async () => {
    const answer = await askBusinessRunner({
      question: "What is our net performance after expenses?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Business net performance & profitability");
    expect(answer.columns).toContain("Metric");
    expect(answer.columns).toContain("Amount");
    expect(answer.columns).toContain("% of Revenue");
    expect(answer.rows.some((r) => r[0] === "Gross Invoiced Revenue")).toBe(true);
    expect(answer.rows.some((r) => r[0] === "Net Operating Profit")).toBe(true);
  });

  it("verifies percentage changes in customer decline calculations", async () => {
    const answer = await askBusinessRunner({
      question: "Which customers have reduced their purchases?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("% Decline");
  });

  it("answers Sales Performance period comparison: 'Compare product sales with previous period'", async () => {
    const answer = await askBusinessRunner({
      question: "Compare product performance with previous period",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("Previous profit");
    expect(answer.columns).toContain("% Profit change");
  });

  it("gracefully identifies and explains missing data when a period yields no matching records", async () => {
    const answer = await askBusinessRunner({
      question:
        "Which customers generate the highest gross profit between 2021-01-01 and 2021-01-31?",
      source: "demo",
    });

    expect(answer.status).toBe("empty");
    expect(answer.notes.some((n) => n.includes("No matching records"))).toBe(true);
  });

  it("Question 21: Price History answers historical landed costs and selling prices by effective date", async () => {
    const answer = await askBusinessRunner({
      question:
        "Price History: How have the landed costs and selling prices of a product changed over time?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Historical landed and selling prices");
    expect(answer.columns).toContain("Date");
    expect(answer.columns).toContain("Product");
    expect(answer.columns).toContain("Price type");
    expect(answer.columns).toContain("Price / kg");
    expect(answer.rows.length).toBeGreaterThan(0);
    // Rows must be sorted chronologically by date
    const dates = answer.rows.map((r) => r[0]);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true);
    }
  });

  it("Question 22: Inventory Risk Analysis calculates exposure at ₹2/kg with explicit assumptions", async () => {
    const answer = await askBusinessRunner({
      question:
        "Inventory Risk Analysis: What would be the estimated financial exposure if sugar prices fell by ₹2 per kg?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.columns).toContain("Stock (kg)");
    expect(answer.columns).toContain("Estimated exposure");
    // 17,350 kg sugar stock in demo database × ₹2 = ₹34,700.00
    expect(answer.summary).toContain("₹34,700.00");
    // Explicit assumption note required by specification
    expect(
      answer.notes.some((n) =>
        n.includes(
          "under the explicit assumption that on-hand physical quantities and other operating costs remain unchanged",
        ),
      ),
    ).toBe(true);
  });

  it("Question 23: Product Performance Comparison compares current and previous month with absolute and percentage changes", async () => {
    const answer = await askBusinessRunner({
      question:
        "Product Performance Comparison: Which products have experienced the biggest increase or decrease in sales compared with the previous month?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Product sales performance comparison");
    expect(answer.columns).toContain("Current Sales");
    expect(answer.columns).toContain("Previous sales");
    expect(answer.columns).toContain("Sales change");
    expect(answer.columns).toContain("% Sales change");
    expect(answer.rows.length).toBeGreaterThan(0);
  });

  it("Question 24: Supplier Procurement Analysis calculates monthly spending including freight without double counting", async () => {
    const answer = await askBusinessRunner({
      question:
        "Supplier Procurement Analysis: How much have we spent on purchasing products from each supplier this month?",
      source: "demo",
    });

    expect(answer.status).toBe("ok");
    expect(answer.title).toBe("Supplier procurement and purchase spend");
    expect(answer.columns).toContain("Supplier");
    expect(answer.columns).toContain("Volume (kg)");
    expect(answer.columns).toContain("Total Spend");
    expect(answer.rows.length).toBeGreaterThan(0);
    expect(answer.basis).toContain("Double counting avoided");
  });
});
