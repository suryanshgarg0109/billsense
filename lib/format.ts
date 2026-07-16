import type { BillAnalysis } from "./types";

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined
): string {
  if (amount === null || amount === undefined) return "—";
  const code = currency || "INR";
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[code] || "en-IN", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString("en-IN")}`;
  }
}

export function formatNumber(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("en-IN")}${suffix}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Effective cost per unit, computed locally so the model never does arithmetic for it. */
export function costPerUnit(a: BillAnalysis): number | null {
  const total = a.totals.totalPayable;
  const units = a.consumption.unitsKwh;
  if (!total || !units || units <= 0) return null;
  return Math.round((total / units) * 100) / 100;
}
