"use client";

import type { BatchItem } from "@/lib/types";
import { costPerUnit, formatDate, formatMoney, formatNumber } from "@/lib/format";
import { download, toBatchCsv } from "@/lib/export";

function billOf(item: BatchItem) {
  const a = item.response?.analysis;
  return a && a.isElectricityBill ? a : null;
}

function FlagBadges({ item }: { item: BatchItem }) {
  const a = billOf(item);
  if (!a) return <span className="text-stone-400">—</span>;
  const critical = a.observations.filter((o) => o.severity === "critical").length;
  const warning = a.observations.filter((o) => o.severity === "warning").length;
  if (!critical && !warning)
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-px text-[11px] font-medium text-emerald-800">
        Clean
      </span>
    );
  return (
    <span className="flex flex-wrap gap-1">
      {critical > 0 && (
        <span className="rounded-full bg-red-100 px-2 py-px text-[11px] font-semibold text-red-800">
          {critical} critical
        </span>
      )}
      {warning > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-px text-[11px] font-semibold text-amber-900">
          {warning} warning{warning > 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

export function BatchView({
  items,
  onOpen,
  onReset,
}: {
  items: BatchItem[];
  onOpen: (index: number) => void;
  onReset: () => void;
}) {
  const settled = items.filter((i) => i.status === "done" || i.status === "error");
  const pending = settled.length < items.length;
  const bills = items.filter((i) => billOf(i));

  const currencies = new Set(
    bills.map((b) => b.response!.analysis.totals.currency).filter(Boolean)
  );
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const sum = (pick: (i: BatchItem) => number | null) =>
    bills.reduce((acc, b) => acc + (pick(b) ?? 0), 0);
  const combinedPayable = sum((b) => b.response!.analysis.totals.totalPayable);
  const combinedUnits = sum((b) => b.response!.analysis.consumption.unitsKwh);
  const flagged = bills.filter((b) =>
    b.response!.analysis.observations.some((o) => o.severity === "critical")
  ).length;

  return (
    <div className="animate-fade-up w-full">
      {/* action bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {pending ? (
            <>
              <span className="animate-soft-pulse mr-1.5 inline-block h-2 w-2 rounded-full bg-spark align-middle" />
              Analyzing bill {Math.min(settled.length + 1, items.length)} of {items.length}…
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{items.length} documents</span> ·{" "}
              {bills.length} bill{bills.length !== 1 ? "s" : ""} analyzed
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => download("billsense-batch.csv", toBatchCsv(items), "text/csv")}
            disabled={pending || bills.length === 0}
            className="rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition-all hover:border-ink hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-line-strong"
          >
            Export combined CSV
          </button>
          <button
            onClick={onReset}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-px"
          >
            Analyze more bills
          </button>
        </div>
      </div>

      {/* aggregate strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(25,24,19,0.04),0_8px_24px_rgba(25,24,19,0.05)] sm:grid-cols-4">
        <div>
          <p className="text-[13px] text-ink-muted">Bills analyzed</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {bills.length}
            <span className="text-sm font-normal text-ink-muted"> / {items.length}</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] text-ink-muted">Combined payable</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {bills.length && currency ? formatMoney(combinedPayable, currency) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-ink-muted">Combined units</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {bills.length ? formatNumber(combinedUnits) : "—"}
            {bills.length ? (
              <span className="ml-1 text-sm font-normal text-ink-muted">kWh</span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-ink-muted">Bills with critical flags</p>
          <p
            className={`mt-0.5 text-xl font-semibold tracking-tight ${flagged > 0 ? "text-red-700" : ""}`}
          >
            {bills.length ? flagged : "—"}
          </p>
        </div>
      </div>

      {/* portfolio table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(25,24,19,0.04),0_8px_24px_rgba(25,24,19,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                <th className="px-5 py-3.5 font-semibold">Bill</th>
                <th className="px-4 py-3.5 font-semibold">Period</th>
                <th className="px-4 py-3.5 text-right font-semibold">Units (kWh)</th>
                <th className="px-4 py-3.5 text-right font-semibold">Total payable</th>
                <th className="px-4 py-3.5 text-right font-semibold">Cost / unit</th>
                <th className="px-4 py-3.5 font-semibold">Due date</th>
                <th className="px-4 py-3.5 font-semibold">Flags</th>
                <th className="w-10 px-3 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const a = billOf(item);
                const cur = a?.totals.currency;
                const openable = item.status === "done";
                return (
                  <tr
                    key={item.id}
                    onClick={openable ? () => onOpen(i) : undefined}
                    className={`border-b border-line last:border-b-0 ${
                      openable
                        ? "cursor-pointer transition-colors duration-150 hover:bg-paper"
                        : ""
                    } ${item.status === "done" ? "animate-fade-up" : ""}`}
                  >
                    <td className="max-w-[260px] px-5 py-3.5">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                        {a ? (a.provider.name ?? "Unknown provider") : ""}
                      </p>
                    </td>
                    {item.status === "queued" && (
                      <td colSpan={6} className="px-4 py-3.5 text-stone-400">
                        Waiting…
                      </td>
                    )}
                    {item.status === "processing" && (
                      <td colSpan={6} className="px-4 py-3.5 text-ink-muted">
                        <span className="animate-soft-pulse mr-2 inline-block h-2 w-2 rounded-full bg-spark align-middle" />
                        Analyzing…
                      </td>
                    )}
                    {item.status === "error" && (
                      <td colSpan={6} className="px-4 py-3.5 text-red-700">
                        {item.error ?? "Analysis failed."}
                      </td>
                    )}
                    {item.status === "done" && !a && (
                      <td colSpan={6} className="px-4 py-3.5 text-ink-muted">
                        Not an electricity bill
                        {item.response?.analysis.documentNote
                          ? ` — ${item.response.analysis.documentNote}`
                          : "."}
                      </td>
                    )}
                    {item.status === "done" && a && (
                      <>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {a.billing.periodFrom
                            ? `${formatDate(a.billing.periodFrom)} – ${formatDate(a.billing.periodTo)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {formatNumber(a.consumption.unitsKwh)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold">
                          {formatMoney(a.totals.totalPayable, cur)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {costPerUnit(a) !== null ? formatMoney(costPerUnit(a), cur) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {formatDate(a.billing.dueDate)}
                        </td>
                        <td className="px-4 py-3.5">
                          <FlagBadges item={item} />
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3.5 text-stone-400">
                      {openable && (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path
                            d="m6 3.5 4.5 4.5L6 12.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {currencies.size > 1 && (
        <p className="mt-3 text-[13px] text-ink-muted">
          Bills are in different currencies, so combined totals are not shown.
        </p>
      )}
      {!pending && bills.length > 0 && (
        <p className="mt-3 text-[13px] text-ink-muted">
          Click any row for the full analysis — summary, charge breakdown, observations, and
          recommendations.
        </p>
      )}
    </div>
  );
}
