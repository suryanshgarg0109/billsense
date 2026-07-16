// Shared shape of an analyzed bill — returned by /api/analyze and rendered by the results view.

export type ChargeCategory =
  | "energy"
  | "demand"
  | "fixed"
  | "tax"
  | "penalty"
  | "rebate"
  | "adjustment"
  | "other";

export type Severity = "info" | "warning" | "critical";

export interface ChargeLine {
  label: string;
  amount: number;
  category: ChargeCategory;
}

export interface Observation {
  severity: Severity;
  title: string;
  detail: string;
}

export interface Recommendation {
  title: string;
  detail: string;
}

export interface BillAnalysis {
  isElectricityBill: boolean;
  /** Set when the document is not a bill, is partially unreadable, or needs a caveat. */
  documentNote: string | null;

  provider: {
    name: string | null;
    region: string | null;
  };

  consumer: {
    number: string | null;
    name: string | null;
    address: string | null;
    tariffCategory: string | null;
    sanctionedLoad: string | null;
  };

  billing: {
    billNumber: string | null;
    billDate: string | null; // ISO yyyy-mm-dd
    periodFrom: string | null;
    periodTo: string | null;
    dueDate: string | null;
  };

  consumption: {
    unitsKwh: number | null;
    billedDemandKva: number | null;
    contractDemandKva: number | null;
    powerFactor: number | null;
    previousReading: number | null;
    currentReading: number | null;
    meterNumber: string | null;
  };

  charges: ChargeLine[];

  totals: {
    currency: string | null; // ISO code, e.g. "INR"
    currentCharges: number | null;
    arrears: number | null;
    subsidyOrRebate: number | null;
    totalPayable: number | null;
  };

  /** Dot-paths of fields the model extracted but is not confident about, e.g. "consumption.powerFactor". */
  lowConfidenceFields: string[];
  /** Dot-paths of fields the model could not find in the document. */
  missingFields: string[];

  summary: string;
  observations: Observation[];
  recommendations: Recommendation[];
}

export interface AnalyzeResponse {
  analysis: BillAnalysis;
  meta: {
    model: string;
    durationMs: number;
  };
}

export interface AnalyzeError {
  error: string;
}
