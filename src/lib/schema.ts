import { z } from 'zod';

/**
 * The canonical extraction schema — BUILD-SPEC §7.2.
 *
 * Every field is nullable on purpose. Missing information is itself signal:
 * several rules fire on nulls (R09 no return ticket, R12 no rest day), and the
 * model is instructed never to infer a favourable term from silence.
 */
export const ExtractedContractSchema = z.object({
  document_language: z.enum(['bn', 'en', 'ar', 'ms', 'mixed', 'unknown']).nullable(),
  document_type_detected: z
    .enum(['contract', 'demand_letter', 'receipt', 'offer_letter', 'other', 'unknown'])
    .nullable(),

  employer_name: z.string().nullable(),
  employer_specific: z.boolean().nullable(),
  workplace_country: z.string().nullable(),
  workplace_country_code: z.string().length(2).nullable(),
  job_title: z.string().nullable(),
  job_title_specific: z.boolean().nullable(),

  salary_amount: z.number().nullable(),
  salary_currency: z.string().nullable(),
  salary_period: z.enum(['month', 'week', 'day', 'hour', 'year']).nullable(),
  salary_in_kind_only: z.boolean().nullable(),

  contract_duration_months: z.number().nullable(),
  probation_months: z.number().nullable(),
  probation_salary_reduced: z.boolean().nullable(),

  working_hours_per_day: z.number().nullable(),
  working_days_per_week: z.number().nullable(),
  weekly_rest_days: z.number().nullable(),
  overtime_rate_defined: z.boolean().nullable(),

  accommodation_provided_by_employer: z.boolean().nullable(),
  food_provided_by_employer: z.boolean().nullable(),
  medical_insurance_provided: z.boolean().nullable(),
  ticket_outbound_paid_by_employer: z.boolean().nullable(),
  ticket_return_paid_by_employer: z.boolean().nullable(),

  // --- passport handling: THREE separate fields, see BUILD-SPEC §8.4 R01 ---
  // Collapsing these would erase the distinction between confiscation (critical)
  // and documented safekeeping (a neutral note). Do not merge them.
  passport_held_by_employer: z.boolean().nullable(),
  passport_return_on_request_guaranteed: z.boolean().nullable(),
  passport_holding_at_worker_request: z.boolean().nullable(),

  worker_may_resign: z.boolean().nullable(),
  exit_permit_required: z.boolean().nullable(),

  recruitment_cost_deducted_from_salary: z.boolean().nullable(),
  deduction_clauses: z.array(z.string()).nullable(),

  agency_name: z.string().nullable(),
  agency_rl_number: z.string().nullable(),
  total_fee_demanded_bdt: z.number().nullable(),

  /**
   * Maps a rule id (e.g. "R01") to the verbatim source sentence it came from.
   * Shown in the UI so the user can check it against their own paper.
   * Without this the tool is unfalsifiable — and unfalsifiable is exactly what
   * judges will attack.
   */
  quoted_clauses: z.record(z.string(), z.string()).nullable(),
  extraction_notes: z.string().nullable(),
});

export type ExtractedContract = z.infer<typeof ExtractedContractSchema>;

/** An all-null contract. Used as the base for partial/failed extractions and in tests. */
export const emptyContract = (): ExtractedContract => ({
  document_language: null,
  document_type_detected: null,
  employer_name: null,
  employer_specific: null,
  workplace_country: null,
  workplace_country_code: null,
  job_title: null,
  job_title_specific: null,
  salary_amount: null,
  salary_currency: null,
  salary_period: null,
  salary_in_kind_only: null,
  contract_duration_months: null,
  probation_months: null,
  probation_salary_reduced: null,
  working_hours_per_day: null,
  working_days_per_week: null,
  weekly_rest_days: null,
  overtime_rate_defined: null,
  accommodation_provided_by_employer: null,
  food_provided_by_employer: null,
  medical_insurance_provided: null,
  ticket_outbound_paid_by_employer: null,
  ticket_return_paid_by_employer: null,
  passport_held_by_employer: null,
  passport_return_on_request_guaranteed: null,
  passport_holding_at_worker_request: null,
  worker_may_resign: null,
  exit_permit_required: null,
  recruitment_cost_deducted_from_salary: null,
  deduction_clauses: null,
  agency_name: null,
  agency_rl_number: null,
  total_fee_demanded_bdt: null,
  quoted_clauses: null,
  extraction_notes: null,
});
