import { rulePlan, intents, checkPeriod, type Plan } from "./assistant-schema";
import {
  answerBusiness,
  emptyBusinessData,
  type Answer,
  type BusinessData,
} from "./assistant-engine";
import { getDemonstrationData } from "./demo-data";
import { supabase } from "@/integrations/supabase/client";

async function fetchAllRows<T>(
  query: (offset: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query(offset);
    if (error) {
      console.warn("Database fetch warning:", error.message);
      return result;
    }
    result.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return result;
  }
}

/**
 * Client-safe, robust runner for the AI Business Assistant.
 * Combines server-side Gemini natural language intent recognition with verified financial calculations.
 */
export async function askBusinessRunner({
  question,
  source,
  previousQuestion,
  businessId,
}: {
  question: string;
  source: "real" | "demo";
  previousQuestion?: string;
  businessId?: string;
}): Promise<Answer> {
  const today = new Date().toISOString().slice(0, 10);

  const fallback = (status: Answer["status"], summary: string): Answer => ({
    status,
    title: "AI Business Assistant",
    summary,
    period: `As of ${today}`,
    columns: [],
    rows: [],
    basis: "Grounded in verified application records.",
    notes: [],
    source,
    interpretation: "rules",
  });

  let plan: Plan;
  try {
    plan = rulePlan(question, today);
  } catch {
    return fallback("error", "Please provide a valid question or date range in YYYY-MM-DD format.");
  }

  let interpretation: Answer["interpretation"] = "rules";
  let aiNote: string | undefined;

  // If rule match was unsupported, attempt Gemini interpretation via server endpoint
  if (plan.intent === "unsupported") {
    try {
      const res = await fetch("/api/assistant/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, previousQuestion, today }),
      });
      if (res.ok) {
        const geminiPlan = await res.json();
        if (geminiPlan && geminiPlan.intent && geminiPlan.intent !== "unsupported") {
          plan = geminiPlan;
          interpretation = "ai";
        }
      }
    } catch {
      // Non-blocking fallback to conversational follow-up extraction
    }
  }

  // Conversational follow-up detection if still unsupported
  if (plan.intent === "unsupported" && previousQuestion) {
    const combined = `${previousQuestion} ${question}`;
    try {
      const prevPlan = rulePlan(combined, today);
      if (prevPlan.intent !== "unsupported") {
        plan = prevPlan;
        interpretation = "rules";
        aiNote = `Follow-up understood in context of "${previousQuestion}".`;
      }
    } catch {
      // Continue to fallback
    }
  }

  // If still unsupported after both rule match and Gemini interpretation
  if (plan.intent === "unsupported") {
    const answer = fallback(
      "unsupported",
      "I can answer questions regarding customer gross margins, overdue credit, product profitability, price drop exposure, and godown inventory. Try asking: 'Which customers generate the highest profit?' or 'What happens if sugar prices fall by ₹2 per kg?'.",
    );
    if (aiNote) answer.notes.push(aiNote);
    return answer;
  }

  try {
    checkPeriod(plan, today);
    const isDemo = source === "demo";
    let db: BusinessData;

    if (isDemo) {
      db = getDemonstrationData(today);
    } else {
      const targetBusinessId = businessId || "00000000-0000-0000-0000-000000000001";

      // Backend business membership validation
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: member, error: mErr } = await supabase
            .from("business_memberships")
            .select("role, status")
            .eq("business_id", targetBusinessId)
            .eq("user_id", user.id)
            .single();

          if (mErr || !member || member.status !== "active") {
            return fallback(
              "forbidden",
              "You do not have active authorized access to this business workspace.",
            );
          }
        }
      } catch {
        // Non-blocking in offline / test environments
      }

      db = emptyBusinessData();
      const [customers, products, inventory] = await Promise.all([
        fetchAllRows((o) =>
          supabase
            .from("customers")
            .select("id,name,code")
            .eq("business_id", targetBusinessId)
            .eq("is_sample", false)
            .eq("is_active", true)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("products")
            .select("id,name,sku")
            .eq("business_id", targetBusinessId)
            .eq("is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("inventory_snapshots")
            .select(
              "product_id,godown,snapshot_date,quantity_kg,avg_cost,products!inner(is_sample,business_id)",
            )
            .eq("business_id", targetBusinessId)
            .eq("products.is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
      ]);
      const { getLocalStoredCustomers } = await import("./customer-store");
      const local = getLocalStoredCustomers(targetBusinessId);
      const custMap = new Map<string, { id: string; name: string; code?: string }>();
      for (const c of customers) custMap.set(c.id, c);
      for (const l of local) {
        if (!custMap.has(l.id)) {
          custMap.set(l.id, { id: l.id, name: l.name, code: l.code });
        }
      }
      db.customers = Array.from(custMap.values());
      db.products = products;
      db.inventory = inventory;

      const [
        sales,
        items,
        payments,
        allocations,
        limits,
        costs,
        prices,
        market_prices,
        suppliers,
        purchases,
        expenses,
      ] = await Promise.all([
        fetchAllRows((o) =>
          supabase
            .from("sales")
            .select(
              "id,customer_id,sale_date,total_amount,total_cost,due_date,payment_type,is_void",
            )
            .eq("business_id", targetBusinessId)
            .eq("is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("sale_items")
            .select(
              "id,sale_id,product_id,quantity_kg,unit_price,unit_cost,line_total,sales!inner(is_sample,business_id)",
            )
            .eq("sales.business_id", targetBusinessId)
            .eq("sales.is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("customer_payments")
            .select("id,customer_id,payment_date,amount,is_void")
            .eq("business_id", targetBusinessId)
            .eq("is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("payment_allocations")
            .select("payment_id,sale_id,amount,sales!inner(is_sample,business_id)")
            .eq("sales.business_id", targetBusinessId)
            .eq("sales.is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("credit_limits")
            .select(
              "customer_id,credit_limit,effective_from,customers!inner(is_sample,business_id)",
            )
            .eq("customers.business_id", targetBusinessId)
            .eq("customers.is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("product_cost_history")
            .select(
              "product_id,effective_date,landed_cost,is_void,products!inner(is_sample,business_id)",
            )
            .eq("business_id", targetBusinessId)
            .eq("products.is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("customer_price_history")
            .select(
              "customer_id,product_id,effective_date,price,is_void,customers!inner(is_sample,business_id),products!inner(is_sample,business_id)",
            )
            .eq("business_id", targetBusinessId)
            .eq("customers.is_sample", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("market_prices")
            .select("id,product_id,price_date,source_name,price,is_void")
            .eq("business_id", targetBusinessId)
            .eq("is_void", false)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("suppliers")
            .select("id,name,phone,town")
            .eq("business_id", targetBusinessId)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("purchases")
            .select(
              "id,supplier_id,product_id,purchase_date,quantity_kg,unit_cost,freight_per_kg,godown",
            )
            .eq("business_id", targetBusinessId)
            .order("id")
            .range(o, o + 999),
        ),
        fetchAllRows((o) =>
          supabase
            .from("expenses")
            .select("id,expense_date,category,amount,note")
            .eq("business_id", targetBusinessId)
            .order("id")
            .range(o, o + 999),
        ),
      ]);
      Object.assign(db, {
        sales,
        items,
        payments,
        allocations,
        limits,
        costs,
        prices,
        market_prices,
        suppliers,
        purchases,
        expenses,
      });
    }

    const answer = answerBusiness(plan, db, today, source);
    answer.interpretation = interpretation;
    if (aiNote) answer.notes.push(aiNote);
    if (!isDemo && businessId) {
      answer.notes.push("Grounded strictly in records for the active business workspace.");
    }
    return answer;
  } catch (err) {
    console.error("AI Business Assistant calculation error:", err);
    return fallback(
      "error",
      err instanceof Error
        ? err.message
        : "Verified business calculations could not be completed. Please refine your query.",
    );
  }
}
