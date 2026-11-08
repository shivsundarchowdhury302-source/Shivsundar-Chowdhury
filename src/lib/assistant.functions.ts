import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from "@/integrations/supabase/client";
import {
  requestSchema,
  rulePlan,
  planSchema,
  intents,
  checkPeriod,
  type Plan,
} from "./assistant-schema";
import {
  answerBusiness,
  emptyBusinessData,
  type Answer,
  type BusinessData,
} from "./assistant-engine";
import { getDemonstrationData } from "./demo-data";

async function rows<T>(
  query: (offset: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query(offset);
    if (error)
      throw new Error("Business records could not be read. Check your access and try again.");
    result.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return result;
  }
}

async function interpretQuestionWithGemini(
  question: string,
  previousQuestion: string | undefined,
  today: string,
): Promise<Plan | null> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Interpret a read-only WholesaleIQ business analytics question. Today is ${today}. Never calculate figures or hallucinate. Return a JSON plan only.
Allowed intents: ${intents.join(", ")}.
Use "unsupported" for requests to modify data or for questions unrelated to business, customers, products, credit, or pricing.
Dates must be inclusive ISO dates (YYYY-MM-DD); null means default period (last 90 days).
customer and product are literal name or code filters (e.g. "sugar", "maida", "Maa Tara Bhandar"), null if absent.
drop is rupees per kg price drop number, null if absent.
Question: "${question}"
Previous question context: "${previousQuestion ?? "none"}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["intent", "from", "to", "product", "customer", "drop"],
          properties: {
            intent: {
              type: Type.STRING,
              enum: [...intents],
            },
            from: { type: Type.STRING },
            to: { type: Type.STRING },
            product: { type: Type.STRING },
            customer: { type: Type.STRING },
            drop: { type: Type.NUMBER },
          },
        },
      },
    });

    const text = response.text?.trim();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return planSchema.parse({
      intent: parsed.intent ?? "unsupported",
      from: parsed.from || null,
      to: parsed.to || null,
      product: parsed.product || null,
      customer: parsed.customer || null,
      drop: typeof parsed.drop === "number" ? parsed.drop : null,
    });
  } catch (err) {
    console.warn("Gemini question interpretation error:", err);
    return null;
  }
}

export const askBusiness = createServerFn({ method: "POST" })
  .inputValidator(requestSchema)
  .handler(async ({ data }): Promise<Answer> => {
    const today = new Date().toISOString().slice(0, 10);
    const fallback = (status: Answer["status"], summary: string): Answer => ({
      status,
      title: "Business assistant",
      summary,
      period: `As of ${today}`,
      columns: [],
      rows: [],
      basis: "No figures calculated.",
      notes: [],
      source: data.source,
      interpretation: "rules",
    });

    let plan: Plan;
    try {
      plan = rulePlan(data.question, today);
    } catch {
      return fallback("error", "Enter valid dates in YYYY-MM-DD format.");
    }

    let interpretation: Answer["interpretation"] = "rules";
    let aiNote: string | undefined;

    if (plan.intent === "unsupported") {
      try {
        const geminiPlan = await interpretQuestionWithGemini(
          data.question,
          data.previousQuestion,
          today,
        );
        if (geminiPlan && geminiPlan.intent !== "unsupported") {
          plan = geminiPlan;
          interpretation = "ai";
        }
      } catch {
        aiNote =
          "AI interpretation is unavailable for this question. Supported reports still work through verified rule-based handling.";
      }
    }

    if (plan.intent === "unsupported") {
      const answer = fallback(
        "unsupported",
        "Ask about customer profitability, overdue credit, product margins, price sensitivity or inventory godown stock.",
      );
      if (aiNote) answer.notes.push(aiNote);
      return answer;
    }

    try {
      checkPeriod(plan, today);
      const isDemo = data.source === "demo";
      let db: BusinessData;

      if (isDemo) {
        db = getDemonstrationData(today);
      } else {
        db = emptyBusinessData();
        const [customers, products, inventory] = await Promise.all([
          rows((o) =>
            supabase
              .from("customers")
              .select("id,name,code")
              .eq("is_sample", false)
              .eq("is_active", true)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("products")
              .select("id,name,sku")
              .eq("is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("inventory_snapshots")
              .select(
                "product_id,godown,snapshot_date,quantity_kg,avg_cost,products!inner(is_sample)",
              )
              .eq("products.is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
        ]);
        db.customers = customers;
        db.products = products;
        db.inventory = inventory;

        const [sales, items, payments, allocations, limits, costs, prices] = await Promise.all([
          rows((o) =>
            supabase
              .from("sales")
              .select(
                "id,customer_id,sale_date,total_amount,total_cost,due_date,payment_type,is_void",
              )
              .eq("is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("sale_items")
              .select(
                "id,sale_id,product_id,quantity_kg,unit_price,unit_cost,line_total,sales!inner(is_sample)",
              )
              .eq("sales.is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("customer_payments")
              .select("id,customer_id,payment_date,amount,is_void")
              .eq("is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("payment_allocations")
              .select("payment_id,sale_id,amount,sales!inner(is_sample)")
              .eq("sales.is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("credit_limits")
              .select("customer_id,credit_limit,effective_from,customers!inner(is_sample)")
              .eq("customers.is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("product_cost_history")
              .select("product_id,effective_date,landed_cost,is_void,products!inner(is_sample)")
              .eq("products.is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
          rows((o) =>
            supabase
              .from("customer_price_history")
              .select(
                "customer_id,product_id,effective_date,price,is_void,customers!inner(is_sample),products!inner(is_sample)",
              )
              .eq("customers.is_sample", false)
              .order("id")
              .range(o, o + 999),
          ),
        ]);
        Object.assign(db, { sales, items, payments, allocations, limits, costs, prices });
      }

      const answer = answerBusiness(plan, db, today, data.source);
      answer.interpretation = interpretation;
      if (aiNote) answer.notes.push(aiNote);
      return answer;
    } catch (error) {
      return fallback(
        "error",
        error instanceof Error
          ? error.message
          : "Business records could not be read. Please try again.",
      );
    }
  });
