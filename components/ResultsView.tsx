"use client";

import type { AnalyzeResponse, ChargeCategory, Severity } from "@/lib/types";
import { costPerUnit, formatDate, formatMoney, formatNumber } from "@/lib/format";
import { download, toCsv } from "@/lib/export";
import { CountUp } from "@/components/CountUp";

/* ---------- field labels (also used to explain confidence caveats) ---------- */

const FIELD_LABELS: Record<string, string> = {
  "provider.name": "Utility provider",
  "provider.region": "Region",
  "consumer.number": "Consumer number",
  "consumer.name": "Consumer name",
  "consumer.address": "Supply address",
  "consumer.tariffCategory": "Tariff category",
  "consumer.sanctionedLoad": "Sanctioned load",
  "billing.billNumber": "Bill number",
  "billing.billDate": "Bill date",
  "billing.periodFrom": "Period start",
  "billing.periodTo": "Period end",
  "billing.dueDate": "Due date",
  "consumption.unitsKwh": "Units consumed",
  "consumption.billedDemandKva": "Billed demand",
  "consumption.contractDemandKva": "Contract demand",
  "consumption.powerFactor": "Power factor",
  "consumption.previousReading": "Previous reading",
  "consumption.currentReading": "Current reading",
  "consumption.meterNumber": "Meter number",
  "totals.currentCharges": "Current charges",
  "totals.arrears": "Arrears",
  "totals.subsidyOrRebate": "Subsidy / rebate",
  "totals.totalPayable": "Total payable",
};

const prettyField = (path: string) => FIELD_LABELS[path] ?? path;

/* ---------- small building blocks ---------- */

function Card({
  title,
  children,
  className = "",
  delayMs,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(25,24,19,0.04),0_8px_24px_rgba(25,24,19,0.05)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(25,24,19,0.04),0_14px_36px_rgba(25,24,19,0.09)] ${
        delayMs !== undefined ? "animate-fade-up" : ""
      } ${className}`}
      style={delayMs !== undefined ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {title && (
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  uncertain,
  mono,
}: {
  label: string;
  value: string;
  uncertain?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-[15px] font-medium ${mono ? "font-mono text-[14px]" : ""} ${
          value === "—" ? "text-stone-400" : ""
        }`}
        title={value}
      >
        {value}
        {uncertain && (
          <span
            className="ml-1.5 inline-block h-2 w-2 rounded-full bg-spark align-middle"
            title="The AI was not fully confident about this value — verify against the bill."
          />
        )}
      </dd>
    </div>
  );
}

const CATEGORY_STYLES: Record<ChargeCategory, string> = {
  energy: "bg-amber-100 text-amber-900",
  demand: "bg-orange-100 text-orange-900",
  fixed: "bg-stone-200 text-stone-700",
  tax: "bg-sky-100 text-sky-900",
  penalty: "bg-red-100 text-red-800",
  rebate: "bg-emerald-100 text-emerald-800",
  adjustment: "bg-violet-100 text-violet-800",
  other: "bg-stone-100 text-stone-600",
};

const SEVERITY_STYLES: Record<Severity, { border: string; badge: string; label: string }> = {
  critical: { border: "border-l-red-500", badge: "bg-red-100 text-red-800", label: "Critical" },
  warning: { border: "border-l-amber-500", badge: "bg-amber-100 text-amber-900", label: "Attention" },
  info: { border: "border-l-sky-400", badge: "bg-sky-100 text-sky-900", label: "Note" },
};

/* ---------- main view ---------- */

export function ResultsView({
  response,
  file,
  onReset,
  resetLabel = "Analyze another bill",
}: {
  response: AnalyzeResponse;
  file: { name: string; url: string; type: string };
  onReset: () => void;
  resetLabel?: string;
}) {
  const a = response.analysis;
  const uncertain = new Set(a.lowConfidenceFields ?? []);
  const isUncertain = (path: string) => uncertain.has(path);
  const perUnit = costPerUnit(a);
  const currency = a.totals.currency;
  const seconds = (response.meta.durationMs / 1000).toFixed(1);
  const exportBase = file.name.replace(/\.[^.]+$/, "");

  if (!a.isElectricityBill) {
    return (
      <div className="animate-fade-up mx-auto w-full max-w-2xl">
        <Card>
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">
              🤔
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                This doesn&apos;t look like an electricity bill
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                {a.documentNote ||
                  "The AI examined the document but could not identify it as an electricity bill."}
              </p>
              <button
                onClick={onReset}
                className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-px"
              >
                Try another document
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const maxCharge = Math.max(...a.charges.map((c) => Math.abs(c.amount)), 1);

  return (
    <div className="animate-fade-up w-full">
      {/* action bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-muted">
            <span className="font-medium text-ink">{file.name}</span> · analyzed in {seconds}s
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => download(`${exportBase}.csv`, toCsv(a), "text/csv")}
            className="rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition-all hover:border-ink hover:-translate-y-px"
          >
            Export CSV
          </button>
          <button
            onClick={() =>
              download(`${exportBase}.json`, JSON.stringify(a, null, 2), "application/json")
            }
            className="rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition-all hover:border-ink hover:-translate-y-px"
          >
            Export JSON
          </button>
          <button
            onClick={onReset}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-px"
          >
            {resetLabel}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* left: original document */}
        <div className="order-2 lg:order-1">
          <div
            className="animate-fade-up lg:sticky lg:top-6 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(25,24,19,0.04),0_8px_24px_rgba(25,24,19,0.05)]"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Original document
              </span>
            </div>
            {file.type === "application/pdf" ? (
              <iframe
                src={`${file.url}#toolbar=0&navpanes=0`}
                title="Uploaded bill"
                className="h-[540px] w-full lg:h-[680px]"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.url} alt="Uploaded bill" className="w-full" />
            )}
          </div>
        </div>

        {/* right: intelligence */}
        <div className="order-1 space-y-6 lg:order-2">
          {/* summary + headline numbers */}
          <Card title="AI summary" delayMs={0}>
            <p className="text-[15px] leading-relaxed text-ink-soft">{a.summary}</p>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
              <div>
                <p className="text-[13px] text-ink-muted">Total payable</p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight">
                  {a.totals.totalPayable !== null ? (
                    <CountUp
                      value={a.totals.totalPayable}
                      format={(n) => formatMoney(Math.round(n), currency)}
                    />
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-ink-muted">Units consumed</p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight">
                  {a.consumption.unitsKwh !== null ? (
                    <>
                      <CountUp
                        value={a.consumption.unitsKwh}
                        format={(n) => formatNumber(Math.round(n))}
                      />
                      <span className="ml-1 text-sm font-normal text-ink-muted">kWh</span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-ink-muted">Cost per unit</p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight">
                  {perUnit !== null ? (
                    <CountUp
                      value={perUnit}
                      format={(n) => formatMoney(Math.round(n * 100) / 100, currency)}
                    />
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div>
                <p className="text-[13px] text-ink-muted">Due date</p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight">
                  {formatDate(a.billing.dueDate)}
                </p>
              </div>
            </div>
          </Card>

          {/* extracted details */}
          <Card title="Extracted details" delayMs={90}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact
                label="Provider"
                value={a.provider.name ?? "—"}
                uncertain={isUncertain("provider.name")}
              />
              <Fact
                label="Region"
                value={a.provider.region ?? "—"}
                uncertain={isUncertain("provider.region")}
              />
              <Fact
                label="Tariff category"
                value={a.consumer.tariffCategory ?? "—"}
                uncertain={isUncertain("consumer.tariffCategory")}
              />
              <Fact
                label="Consumer number"
                value={a.consumer.number ?? "—"}
                uncertain={isUncertain("consumer.number")}
                mono
              />
              <Fact
                label="Consumer name"
                value={a.consumer.name ?? "—"}
                uncertain={isUncertain("consumer.name")}
              />
              <Fact
                label="Sanctioned load"
                value={a.consumer.sanctionedLoad ?? "—"}
                uncertain={isUncertain("consumer.sanctionedLoad")}
              />
              <Fact
                label="Bill number"
                value={a.billing.billNumber ?? "—"}
                uncertain={isUncertain("billing.billNumber")}
                mono
              />
              <Fact
                label="Bill date"
                value={formatDate(a.billing.billDate)}
                uncertain={isUncertain("billing.billDate")}
              />
              <Fact
                label="Billing period"
                value={
                  a.billing.periodFrom || a.billing.periodTo
                    ? `${formatDate(a.billing.periodFrom)} – ${formatDate(a.billing.periodTo)}`
                    : "—"
                }
                uncertain={
                  isUncertain("billing.periodFrom") || isUncertain("billing.periodTo")
                }
              />
              <Fact
                label="Meter number"
                value={a.consumption.meterNumber ?? "—"}
                uncertain={isUncertain("consumption.meterNumber")}
                mono
              />
              <Fact
                label="Meter readings"
                value={
                  a.consumption.previousReading !== null &&
                  a.consumption.currentReading !== null
                    ? `${formatNumber(a.consumption.previousReading)} → ${formatNumber(a.consumption.currentReading)}`
                    : "—"
                }
                uncertain={
                  isUncertain("consumption.previousReading") ||
                  isUncertain("consumption.currentReading")
                }
              />
              <Fact
                label="Power factor"
                value={a.consumption.powerFactor !== null ? String(a.consumption.powerFactor) : "—"}
                uncertain={isUncertain("consumption.powerFactor")}
              />
              {a.consumption.billedDemandKva !== null && (
                <Fact
                  label="Billed demand"
                  value={formatNumber(a.consumption.billedDemandKva, " kVA")}
                  uncertain={isUncertain("consumption.billedDemandKva")}
                />
              )}
              {a.consumption.contractDemandKva !== null && (
                <Fact
                  label="Contract demand"
                  value={formatNumber(a.consumption.contractDemandKva, " kVA")}
                  uncertain={isUncertain("consumption.contractDemandKva")}
                />
              )}
              <Fact
                label="Supply address"
                value={a.consumer.address ?? "—"}
                uncertain={isUncertain("consumer.address")}
              />
            </dl>
          </Card>

          {/* charge breakdown */}
          {a.charges.length > 0 && (
            <Card title="Charge breakdown" delayMs={180}>
              <ul className="space-y-1">
                {a.charges.map((c, i) => (
                  <li
                    key={`${c.label}-${i}`}
                    className="-mx-2 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-paper"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[14px]">{c.label}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-px text-[11px] font-medium ${CATEGORY_STYLES[c.category] ?? CATEGORY_STYLES.other}`}
                        >
                          {c.category}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[14px] ${c.amount < 0 ? "text-emerald-700" : ""}`}
                      >
                        {formatMoney(c.amount, currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`animate-bar h-full rounded-full ${c.amount < 0 ? "bg-emerald-400" : c.category === "penalty" ? "bg-red-400" : "bg-spark"}`}
                        style={{
                          width: `${Math.max((Math.abs(c.amount) / maxCharge) * 100, 2)}%`,
                          animationDelay: `${i * 60}ms`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                <span className="text-[14px] font-semibold">Total payable</span>
                <span className="font-mono text-[15px] font-semibold">
                  {formatMoney(a.totals.totalPayable, currency)}
                </span>
              </div>
              {(a.totals.arrears ?? 0) > 0 && (
                <p className="mt-2 text-[13px] text-ink-muted">
                  Includes {formatMoney(a.totals.arrears, currency)} of arrears from previous
                  bills.
                </p>
              )}
            </Card>
          )}

          {/* observations */}
          {a.observations.length > 0 && (
            <Card title="What the AI noticed" delayMs={270}>
              <ul className="space-y-3">
                {a.observations.map((o, i) => {
                  const s = SEVERITY_STYLES[o.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <li
                      key={i}
                      className={`rounded-xl border border-line border-l-4 bg-paper/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-paper hover:shadow-[0_6px_16px_rgba(25,24,19,0.07)] ${s.border}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`rounded-full px-2 py-px text-[11px] font-semibold ${s.badge}`}
                        >
                          {s.label}
                        </span>
                        <span className="text-[14px] font-semibold">{o.title}</span>
                      </div>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                        {o.detail}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* recommendations */}
          {a.recommendations.length > 0 && (
            <Card title="Suggested actions" delayMs={360}>
              <ol className="space-y-3.5">
                {a.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="-mx-2 flex gap-3.5 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-paper"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold">{r.title}</p>
                      <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">
                        {r.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* honesty footer: what the AI wasn't sure about */}
          {(a.missingFields.length > 0 ||
            a.lowConfidenceFields.length > 0 ||
            a.documentNote) && (
            <div className="rounded-2xl border border-dashed border-line-strong bg-paper px-5 py-4 text-[13px] leading-relaxed text-ink-muted">
              <p className="font-semibold text-ink-soft">Model confidence</p>
              {a.documentNote && <p className="mt-1">{a.documentNote}</p>}
              {a.lowConfidenceFields.length > 0 && (
                <p className="mt-1">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-spark align-middle" />
                  Verify against the original: {a.lowConfidenceFields.map(prettyField).join(", ")}.
                </p>
              )}
              {a.missingFields.length > 0 && (
                <p className="mt-1">
                  Not found on this bill: {a.missingFields.map(prettyField).join(", ")}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
