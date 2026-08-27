/**
 * Shared domain types for SafeMigrate.
 * These are platform-neutral and used identically on Vercel, in the browser, and in the APK.
 */

// ---------------------------------------------------------------------------
// Documents & extraction
// ---------------------------------------------------------------------------

export type DocType = 'contract' | 'demand_letter' | 'receipt' | 'other';

export const DOC_TYPES: readonly DocType[] = ['contract', 'demand_letter', 'receipt', 'other'];

// ---------------------------------------------------------------------------
// Rules engine (BUILD-SPEC §8)
// ---------------------------------------------------------------------------

/** Warning rules R01–R14 raise overall risk; informational I01–I03 never do. */
export type WarningRuleId =
  | 'R01' | 'R02' | 'R03' | 'R04' | 'R05' | 'R06' | 'R07'
  | 'R08' | 'R09' | 'R10' | 'R11' | 'R12' | 'R13' | 'R14';

export type InfoRuleId = 'I01' | 'I02' | 'I03';

export type RuleId = WarningRuleId | InfoRuleId;

export type Severity = 'critical' | 'high' | 'medium' | 'info';

export type OverallRisk = 'safe' | 'caution' | 'high' | 'critical';

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  titleKey: string;
  explainKey: string;
  actionKey: string;
  /** Verbatim sentence from the source document that triggered this finding. */
  evidence: string | null;
  computed?: Record<string, string | number>;
  legalRef?: string;
}

export interface AnalysisResult {
  findings: Finding[];
  overallRisk: OverallRisk;
  checkedCount: number;
  skippedCount: number;
}

// ---------------------------------------------------------------------------
// Static reference data (data/*.json — compiled into both bundles)
// ---------------------------------------------------------------------------

export type AgencyStatus = 'active' | 'suspended' | 'expired' | 'cancelled';

export interface Agency {
  /** Recruiting Licence number, digits only after normalisation. */
  rl_number: string;
  name: string;
  name_bn: string | null;
  status: AgencyStatus;
  /** ISO date (YYYY-MM-DD) the licence is valid until, null if unknown. */
  valid_until: string | null;
  district: string | null;
  baira_member: boolean | null;
}

export interface AgencyMatch {
  agency: Agency;
  /** 0–1. 1 = exact RL match. */
  score: number;
  matchedOn: 'rl' | 'name';
}

export interface CostCeiling {
  country_code: string;
  country_en: string;
  country_bn: string;
  /**
   * Government maximum recruitment cost in BDT.
   * null means NOT KNOWN — R02 must skip, never treat it as a zero ceiling,
   * which would flag every fee as a critical overcharge.
   */
  ceiling_bdt: number | null;
  /** Observed national average actually paid, for the comparison bars. */
  actual_avg_bdt: number | null;
}

export interface MinWage {
  country_code: string;
  country_en: string;
  currency: string;
  /** Minimum monthly wage expressed in `currency`. Never converted. */
  min_monthly_local: number;
}

/** Provenance shown on every Agency Verifier and Cost Checker result. */
export interface DataSourceMeta {
  source: string;
  source_url: string | null;
  /** ISO date the data was collected. */
  collected_on: string;
  note: string | null;
}

export interface ReferenceFile<T> {
  meta: DataSourceMeta;
  records: T[];
}

// ---------------------------------------------------------------------------
// API contracts
// ---------------------------------------------------------------------------

export interface ApiError {
  error: {
    code: string;
    /** Dot-path key into data/strings.json. Never a raw model or stack message. */
    userMessageKey: string;
  };
}

export interface ExtractResponse {
  documentId: string;
  extractionId: string;
  parsed: import('@/lib/schema').ExtractedContract;
  confidence: number;
}

export interface AnalyzeResponse {
  analysisId: string;
  result: AnalysisResult;
}
