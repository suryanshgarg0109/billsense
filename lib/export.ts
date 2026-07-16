import type { BillAnalysis } from "./types";
import { costPerUnit } from "./format";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Flat field/value CSV — the shape a finance team would paste into a tracker. */
export function toCsv(a: BillAnalysis): string {
  const rows: [string, string | number | null][] = [
    ["Utility provider", a.provider.name],
    ["Region", a.provider.region],
    ["Consumer number", a.consumer.number],
    ["Consumer name", a.consumer.name],
    ["Address", a.consumer.address],
    ["Tariff category", a.consumer.tariffCategory],
    ["Sanctioned load", a.consumer.sanctionedLoad],
    ["Bill number", a.billing.billNumber],
    ["Bill date", a.billing.billDate],
    ["Period from", a.billing.periodFrom],
    ["Period to", a.billing.periodTo],
    ["Due date", a.billing.dueDate],
    ["Units consumed (kWh)", a.consumption.unitsKwh],
    ["Billed demand (kVA)", a.consumption.billedDemandKva],
    ["Contract demand (kVA)", a.consumption.contractDemandKva],
    ["Power factor", a.consumption.powerFactor],
    ["Meter number", a.consumption.meterNumber],
    ["Currency", a.totals.currency],
    ["Current charges", a.totals.currentCharges],
    ["Arrears", a.totals.arrears],
    ["Subsidy / rebate", a.totals.subsidyOrRebate],
    ["Total payable", a.totals.totalPayable],
    ["Effective cost per unit", costPerUnit(a)],
  ];

  const lines = ["Field,Value"];
  for (const [field, value] of rows) {
    lines.push(`${csvEscape(field)},${csvEscape(value === null || value === undefined ? "" : String(value))}`);
  }

  lines.push("", "Charge line,Amount,Category");
  for (const c of a.charges) {
    lines.push(`${csvEscape(c.label)},${c.amount},${c.category}`);
  }
  return lines.join("\n");
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
