"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useTrip } from "./trip-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { expenseFormSchema, type ExpenseFormInput, type ExpenseFormValues } from "@/lib/schemas";
import { EXPENSE_CATEGORIES } from "@/lib/options";
import type { Expense } from "@/lib/types";
import { cn, CURRENCIES, formatDate, formatMoney, nowIso, todayString, uid } from "@/lib/utils";

function ExpenseEditor({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { bundle, saveExpense } = useTrip();
  const { register, handleSubmit, formState, control } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: expense?.description ?? "",
      category: expense?.category ?? "food",
      amount: expense?.amount ?? ("" as unknown as number),
      currency: expense?.currency ?? bundle.trip.currency,
      date: expense?.date ?? todayString(),
      is_planned: expense?.is_planned ?? false,
    },
  });
  const errors = formState.errors;
  const submit = handleSubmit(async (v) => {
    const ts = nowIso();
    try {
      await saveExpense({ ...v, id: expense?.id ?? uid(), trip_id: bundle.trip.id, created_at: expense?.created_at ?? ts, updated_at: ts });
      onClose();
    } catch {
      // toast shown by context
    }
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? "Edit expense" : "Add expense"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={formState.isSubmitting}>Save</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Description" htmlFor="e-desc" error={errors.description?.message} className="sm:col-span-2">
          <Input id="e-desc" placeholder="e.g. Dinner at Armando" aria-invalid={!!errors.description} {...register("description")} />
        </Field>
        <Field label="Amount" htmlFor="e-amt" error={errors.amount?.message}>
          <Input id="e-amt" type="number" min={0} step="0.01" inputMode="decimal" aria-invalid={!!errors.amount} {...register("amount")} />
        </Field>
        <Field label="Currency" htmlFor="e-cur" hint={`Totals are calculated in ${bundle.trip.currency}.`}>
          <Select id="e-cur" {...register("currency")}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Category" htmlFor="e-cat">
          <Select id="e-cat" {...register("category")}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Date" htmlFor="e-date" error={errors.date?.message}>
          <Input id="e-date" type="date" {...register("date")} />
        </Field>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="is_planned"
            render={({ field }) => (
              <Toggle checked={!!field.value} onChange={field.onChange} label="Planned expense" description="Not paid yet. Counts against your budget, separately from actual spend." />
            )}
          />
        </div>
      </form>
    </Modal>
  );
}

export function BudgetTab() {
  const { bundle, deleteExpense } = useTrip();
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [filter, setFilter] = useState<"all" | "actual" | "planned">("all");
  const t = bundle.trip;
  const c = t.currency;

  const inCurrency = bundle.expenses.filter((e) => e.currency === c);
  const foreign = bundle.expenses.filter((e) => e.currency !== c);
  const spent = inCurrency.filter((e) => !e.is_planned).reduce((s, e) => s + e.amount, 0);
  const planned = inCurrency.filter((e) => e.is_planned).reduce((s, e) => s + e.amount, 0);
  const remaining = t.budget - spent - planned;
  const itineraryEstimate = bundle.days.reduce((s, d) => s + d.activities.reduce((x, a) => x + (a.estimated_cost ?? 0), 0), 0);

  const byCat = EXPENSE_CATEGORIES.map((cat) => {
    const items = inCurrency.filter((e) => e.category === cat.value);
    return {
      ...cat,
      actual: items.filter((e) => !e.is_planned).reduce((s, e) => s + e.amount, 0),
      planned: items.filter((e) => e.is_planned).reduce((s, e) => s + e.amount, 0),
    };
  }).filter((x) => x.actual || x.planned);
  const denom = Math.max(t.budget, spent + planned, 1);

  const list = [...bundle.expenses]
    .filter((e) => (filter === "all" ? true : filter === "planned" ? e.is_planned : !e.is_planned))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Total budget" value={formatMoney(t.budget, c)} hint={t.budget_excludes_flights ? "Excluding flights" : "Including flights"} />
        <Summary label="Spent" value={formatMoney(spent, c)} />
        <Summary label="Planned" value={formatMoney(planned, c)} />
        <Summary label="Remaining" value={formatMoney(remaining, c)} tone={remaining < 0 ? "red" : "green"} hint={remaining < 0 ? "Over budget" : "After planned costs"} />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Breakdown</h2>
          <span className="text-xs text-muted">{Math.round(((spent + planned) / Math.max(t.budget, 1)) * 100)}% of budget allocated</span>
        </div>
        <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-ivory-200" aria-hidden="true">
          {byCat.map((cat) => (
            <span key={cat.value} className="h-full" style={{ width: `${((cat.actual + cat.planned) / denom) * 100}%`, background: cat.color }} title={cat.label} />
          ))}
        </div>
        {byCat.length ? (
          <table className="mt-5 w-full text-sm">
            <caption className="sr-only">Planned versus actual by category</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="pb-2 font-semibold">Category</th>
                <th className="pb-2 text-right font-semibold">Actual</th>
                <th className="pb-2 text-right font-semibold">Planned</th>
                <th className="hidden pb-2 text-right font-semibold sm:table-cell">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byCat.map((cat) => (
                <tr key={cat.value}>
                  <td className="py-2.5"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color }} /> {cat.label}</span></td>
                  <td className="py-2.5 text-right font-medium">{formatMoney(cat.actual, c)}</td>
                  <td className="py-2.5 text-right text-muted">{formatMoney(cat.planned, c)}</td>
                  <td className="hidden py-2.5 text-right font-semibold sm:table-cell">{formatMoney(cat.actual + cat.planned, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-sm text-muted">Add expenses to see where your money goes.</p>
        )}
        {itineraryEstimate > 0 && (
          <p className="mt-4 rounded-xl bg-pilot-50/70 px-3 py-2 text-sm text-navy/80">
            Itinerary activities are estimated at about <b>{formatMoney(itineraryEstimate, c)}</b> in total (AI estimates, not quotes).
          </p>
        )}
        {foreign.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-sm text-gold-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {foreign.length} expense{foreign.length > 1 ? "s are" : " is"} in another currency and {foreign.length > 1 ? "aren't" : "isn't"} included in totals. Currency conversion is coming soon.
          </p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="font-bold">Expenses</h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-ivory-200 p-1 text-sm" role="radiogroup" aria-label="Filter expenses">
              {(["all", "actual", "planned"] as const).map((f) => (
                <button key={f} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 font-semibold capitalize", filter === f ? "bg-white shadow-sm" : "text-muted")}>
                  {f}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setEditing("new")} icon={<Plus className="h-4 w-4" />}>Add</Button>
          </div>
        </div>
        {list.length ? (
          <ul className="mt-4 divide-y divide-line">
            {list.map((e) => {
              const cat = EXPENSE_CATEGORIES.find((x) => x.value === e.category);
              return (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: cat?.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.description}</p>
                    <p className="text-xs text-muted">{cat?.label} · {formatDate(e.date)}</p>
                  </div>
                  {e.is_planned && <Badge>Planned</Badge>}
                  <span className="shrink-0 font-semibold">{formatMoney(e.amount, e.currency)}</span>
                  <button onClick={() => setEditing(e)} className="rounded-full p-1.5 text-muted hover:bg-ivory-200" aria-label={`Edit ${e.description}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void deleteExpense(e.id)} className="rounded-full p-1.5 text-muted hover:bg-danger/5 hover:text-danger" aria-label={`Delete ${e.description}`}><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState className="mt-4" icon={<Receipt className="h-6 w-6" />} title="No expenses yet" description="Log what you spend, or add planned costs to see what's left." />
        )}
      </section>
      {editing && <ExpenseEditor expense={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Summary({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-2xl", tone === "red" && "text-danger", tone === "green" && "text-success")}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
