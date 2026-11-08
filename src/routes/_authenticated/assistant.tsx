import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Sparkles, Send, ShieldCheck, Loader2 } from "lucide-react";
import { askBusinessRunner } from "@/lib/assistant-runner";
import type { Answer } from "@/lib/assistant-engine";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data-source";
import { useTenant } from "@/lib/tenant";
import { pageHead } from "@/lib/page-head";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () =>
    pageHead(
      "AI Business Assistant",
      "Read-only business answers grounded in verified records and financial calculations.",
    ),
  component: AssistantPage,
});

function AssistantPage() {
  const { user } = useAuth();
  const source = useDataSource();
  const { activeBusiness } = useTenant();
  return (
    <Guard path="/assistant">
      <Assistant key={`${user?.id}-${source}-${activeBusiness?.id}`} />
    </Guard>
  );
}

export interface QuestionItem {
  id: number;
  label: string;
  query: string;
}

export interface QuestionCategory {
  title: string;
  shortTitle: string;
  questions: QuestionItem[];
}

export const QUESTION_BANK: QuestionCategory[] = [
  {
    title: "Customer Intelligence & Profitability",
    shortTitle: "Customers",
    questions: [
      {
        id: 1,
        label: "Which customers generate the highest gross profit?",
        query: "Which customers generate the highest gross profit?",
      },
      {
        id: 2,
        label: "Which customers have reduced their purchases?",
        query: "Which customers have reduced their purchases?",
      },
      {
        id: 3,
        label: "Who are our top customer accounts by gross margin?",
        query: "Which customers generate the highest gross profit?",
      },
      {
        id: 4,
        label: "Which customers have declining purchase frequency?",
        query: "Which customers have reduced their purchases?",
      },
    ],
  },
  {
    title: "Credit & Collections Management",
    shortTitle: "Credit",
    questions: [
      {
        id: 5,
        label: "Which customers have overdue payments?",
        query: "Which customers have overdue payments?",
      },
      {
        id: 6,
        label: "Show payment ageing by customer",
        query: "Show payment ageing by customer",
      },
      {
        id: 7,
        label: "Which customers have outstanding credit?",
        query: "Which customers have outstanding credit?",
      },
      {
        id: 8,
        label: "Which customers crossed their credit limit?",
        query: "Which customers crossed their credit limit?",
      },
    ],
  },
  {
    title: "Pricing Intelligence & Profitability",
    shortTitle: "Pricing",
    questions: [
      {
        id: 9,
        label: "Which products have the lowest margins?",
        query: "Which products have the lowest margins?",
      },
      {
        id: 10,
        label: "Which customers receive prices below our landed cost?",
        query: "Which customers receive prices below our landed cost?",
      },
      {
        id: 11,
        label: "How do our prices compare to market prices?",
        query: "How do our prices compare to market prices?",
      },
      {
        id: 21,
        label:
          "21. Price History: How have the landed costs and selling prices of a product changed over time?",
        query:
          "Price History: How have the landed costs and selling prices of a product changed over time?",
      },
    ],
  },
  {
    title: "Inventory & Risk Intelligence",
    shortTitle: "Inventory",
    questions: [
      {
        id: 12,
        label: "What is our current stock and acquisition value?",
        query: "What is our current stock and acquisition value?",
      },
      {
        id: 13,
        label: "Show inventory stock by godown",
        query: "Show inventory stock by godown",
      },
      {
        id: 14,
        label: "What happens if sugar prices fall by ₹2 per kg?",
        query: "What happens if sugar prices fall by ₹2 per kg?",
      },
      {
        id: 22,
        label:
          "22. Inventory Risk Analysis: What would be the estimated financial exposure if sugar prices fell by ₹2 per kg?",
        query:
          "Inventory Risk Analysis: What would be the estimated financial exposure if sugar prices fell by ₹2 per kg?",
      },
    ],
  },
  {
    title: "Sales & Product Performance",
    shortTitle: "Sales",
    questions: [
      {
        id: 15,
        label: "What are our best-selling products by volume?",
        query: "What are our best-selling products by volume?",
      },
      {
        id: 16,
        label: "Which products generate the highest gross revenue?",
        query: "Which products generate the highest gross profit?",
      },
      {
        id: 17,
        label: "Compare product performance with previous period",
        query: "Compare product performance with previous period",
      },
      {
        id: 23,
        label:
          "23. Product Performance Comparison: Which products have experienced the biggest increase or decrease in sales compared with the previous month?",
        query:
          "Product Performance Comparison: Which products have experienced the biggest increase or decrease in sales compared with the previous month?",
      },
    ],
  },
  {
    title: "Procurement, Expenses & Decision Support",
    shortTitle: "Procurement",
    questions: [
      {
        id: 18,
        label: "Which suppliers have the highest purchase volume?",
        query: "Which suppliers have the highest purchase volume?",
      },
      {
        id: 19,
        label: "What are our total expenses by category?",
        query: "What are our total expenses by category?",
      },
      {
        id: 20,
        label: "What is our net performance after expenses?",
        query: "What is our net performance after expenses?",
      },
      {
        id: 24,
        label:
          "24. Supplier Procurement Analysis: How much have we spent on purchasing products from each supplier this month?",
        query:
          "Supplier Procurement Analysis: How much have we spent on purchasing products from each supplier this month?",
      },
    ],
  },
];

export const EXAMPLES = QUESTION_BANK.flatMap((c) => c.questions.map((q) => q.query));

type Msg = { role: "user" | "assistant"; text: string; answer?: Answer };

function Assistant() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const source = useDataSource();
  const { activeBusiness } = useTenant();

  const [selectedCat, setSelectedCat] = useState<string>("All");

  async function ask(text: string) {
    if (!text.trim() || pending.current) return;
    pending.current = true;
    setBusy(true);
    const previousQuestion = [...msgs].reverse().find((m) => m.role === "user")?.text;
    setMsgs((m) => [...m, { role: "user", text }]);
    setQ("");
    try {
      const answer = await askBusinessRunner({
        question: text,
        source,
        previousQuestion,
        businessId: activeBusiness?.id,
      });
      setMsgs((m) => [...m, { role: "assistant", text: answer.summary, answer }]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: "The answer could not be loaded. Your question is preserved; please try again.",
        },
      ]);
      setQ(text);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="AI Business Assistant"
        subtitle="Ask questions in plain language. Answers will be grounded in verified calculations from your data."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="flex min-h-[28rem] flex-col lg:col-span-2">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {msgs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-accent">
                  <Sparkles className="h-5 w-5 text-accent-foreground" />
                </div>
                <p className="mt-3 font-display text-lg">What would you like to know?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try one of the example questions.
                </p>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[80%] rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                      : "max-w-full rounded-xl border bg-secondary px-4 py-2.5 text-sm"
                  }
                >
                  {m.answer && (
                    <>
                      <h2 className="font-semibold">{m.answer.title}</h2>
                      <p className="mb-2 text-xs text-muted-foreground">
                        {m.answer.period} ·{" "}
                        {m.answer.source === "demo" ? "Demonstration" : "Real data"} ·{" "}
                        {m.answer.interpretation === "ai" ? "AI interpreted" : "Verified report"}
                      </p>
                    </>
                  )}
                  <p>{m.text}</p>
                  {!!m.answer?.rows.length && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr>
                            {m.answer.columns.map((c) => (
                              <th key={c} className="whitespace-nowrap border-b p-2">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.answer.rows.map((r, j) => (
                            <tr key={j}>
                              {r.map((v, k) => (
                                <td key={k} className="whitespace-nowrap border-b p-2">
                                  {v}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {m.answer && (
                    <>
                      <p className="mt-3 text-xs text-muted-foreground">{m.answer.basis}</p>
                      {m.answer.notes.map((n, j) => (
                        <p key={j} className="mt-2 text-xs text-muted-foreground">
                          {n}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              ))
            )}
            {busy && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your records…
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
            className="mt-4 flex gap-2 border-t pt-4"
          >
            <Textarea
              aria-label="Business question"
              maxLength={1000}
              rows={1}
              className="min-h-10 resize-none"
              placeholder="Ask about customers, credit, margins or prices…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(q);
                }
              }}
            />
            <Button disabled={busy || !q.trim()} type="submit" size="icon" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Panel>
        <div className="space-y-6">
          <Panel title="Suggested Questions Bank (24)">
            <div className="mb-3 flex flex-wrap gap-1.5 border-b pb-3">
              <button
                type="button"
                onClick={() => setSelectedCat("All")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCat === "All"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                All (24)
              </button>
              {QUESTION_BANK.map((cat) => (
                <button
                  type="button"
                  key={cat.shortTitle}
                  onClick={() => setSelectedCat(cat.shortTitle)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedCat === cat.shortTitle
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {cat.shortTitle} (4)
                </button>
              ))}
            </div>

            <div className="flex max-h-[38rem] flex-col gap-3 overflow-y-auto pr-1">
              {QUESTION_BANK.filter(
                (cat) => selectedCat === "All" || selectedCat === cat.shortTitle,
              ).map((cat) => (
                <div key={cat.title} className="space-y-1.5">
                  <div className="sticky top-0 bg-card/95 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-xs">
                    {cat.title}
                  </div>
                  {cat.questions.map((item) => (
                    <Button
                      variant="outline"
                      disabled={busy}
                      key={item.id}
                      onClick={() => ask(item.query)}
                      className={`h-auto w-full whitespace-normal px-3 py-2 text-left text-xs justify-start hover:border-success hover:bg-accent ${
                        item.id >= 21 ? "border-primary/40 bg-accent/30 font-medium" : ""
                      }`}
                    >
                      <span className="line-clamp-3">{item.label}</span>
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
              <p className="text-sm text-muted-foreground">
                No invented answers. Responses will cite the database figures used and respect your
                role's access permissions.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
