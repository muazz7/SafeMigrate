import type { DocType } from '@/types';

/**
 * The extraction prompt — BUILD-SPEC §7.3.
 *
 * The model's ONLY job is to read fields off the page. It never decides whether
 * something is a violation; `lib/rules.ts` does that deterministically. Keeping
 * that boundary sharp is what lets us answer "how do you know the AI isn't
 * hallucinating violations?" — it cannot, because it never sees a rule.
 *
 * The prompt is sent on every request, so it stays compact: one few-shot example,
 * no decorative prose (§7.3, and a ≤$5 model budget).
 */

const DOC_TYPE_HINT: Record<DocType, string> = {
  contract: 'an employment contract',
  demand_letter: 'a demand letter from an employer or agency',
  receipt: 'a payment receipt',
  other: 'a migration-related document',
};

/** One compact example. Shows null-for-silence and the quoted_clauses contract. */
const FEW_SHOT = `EXAMPLE
Input page text: "The Employer shall provide accommodation. The Employee's passport
will be kept by the Employer in the company safe and returned to the Employee upon
written request at any time. Salary: SAR 1,500 per month."

Correct output:
{"document_language":"en","document_type_detected":"contract","employer_name":null,
"employer_specific":null,"workplace_country":null,"workplace_country_code":null,
"job_title":null,"job_title_specific":null,"salary_amount":1500,"salary_currency":"SAR",
"salary_period":"month","salary_in_kind_only":null,"contract_duration_months":null,
"probation_months":null,"probation_salary_reduced":null,"working_hours_per_day":null,
"working_days_per_week":null,"weekly_rest_days":null,"overtime_rate_defined":null,
"accommodation_provided_by_employer":true,"food_provided_by_employer":null,
"medical_insurance_provided":null,"ticket_outbound_paid_by_employer":null,
"ticket_return_paid_by_employer":null,"passport_held_by_employer":true,
"passport_return_on_request_guaranteed":true,"passport_holding_at_worker_request":null,
"worker_may_resign":null,"exit_permit_required":null,
"recruitment_cost_deducted_from_salary":null,"deduction_clauses":null,"agency_name":null,
"agency_rl_number":null,"total_fee_demanded_bdt":null,
"quoted_clauses":{"passport":"The Employee's passport will be kept by the Employer in the company safe and returned to the Employee upon written request at any time.","accommodation":"The Employer shall provide accommodation."},
"extraction_notes":null}

Note what did NOT happen: the return ticket was never mentioned, so
ticket_return_paid_by_employer stayed null — NOT false. Food was never mentioned, so
it stayed null — NOT false. Nothing was inferred from silence.`;

export function buildExtractionPrompt(docType: DocType): string {
  return `You are a careful document analyst for a Bangladeshi migrant-worker protection service.

TASK
Read the attached image or PDF. It is ${DOC_TYPE_HINT[docType]}. It may be written in
Bangla, English, Arabic, Malay, or a mixture. It is likely a phone photograph: taken at
an angle, poorly lit, partly cropped, or creased. Extract only what the document
actually states.

OUTPUT
Return JSON only, matching the schema below exactly. No markdown fences, no commentary,
no explanation before or after the JSON.

ABSOLUTE RULES
1. Use null for anything not clearly stated. Never guess.
2. Never infer a favourable term from silence. If the return ticket is not mentioned,
   ticket_return_paid_by_employer is null — not false, and not true. Silence is null.
3. Set employer_specific to false when the employer is described generically
   ("a company in Malaysia", "the sponsor") rather than named.
4. Set job_title_specific to false when the job is vague ("general worker", "helper",
   "as assigned by the employer").
5. For every boolean you set to true or false, add the verbatim supporting sentence to
   quoted_clauses. Copy the sentence exactly as printed; do not paraphrase or translate it.
6. Preserve the original currency code and amount. Do not convert between currencies.
7. If the document is unreadable, return every field as null and describe why in
   extraction_notes.

PASSPORT FIELDS — read this carefully, it is the subtlest part of the schema
There are three separate fields. Never collapse them into one.

- passport_held_by_employer: true if the document says the employer, sponsor, or agency
  will hold, keep, retain, take custody of, or "safeguard" the worker's passport for any
  period of time.
- passport_return_on_request_guaranteed: true ONLY if the document states in writing that
  the passport will be returned on demand, on request, or at any time the worker asks.
  If the document is silent on returning it, this is null — NOT false.
- passport_holding_at_worker_request: true only if the document frames the holding as
  being at the worker's own request or with the worker's written consent.

The distinction between confiscation and documented safekeeping decides whether the
worker sees a critical warning or a neutral note. Read the clause twice before setting
these three.

SCHEMA (every field is required in the output; use null where not stated)
document_language: "bn"|"en"|"ar"|"ms"|"mixed"|"unknown"|null
document_type_detected: "contract"|"demand_letter"|"receipt"|"offer_letter"|"other"|"unknown"|null
employer_name: string|null
employer_specific: boolean|null
workplace_country: string|null
workplace_country_code: 2-letter ISO code string|null
job_title: string|null
job_title_specific: boolean|null
salary_amount: number|null
salary_currency: 3-letter code string|null
salary_period: "month"|"week"|"day"|"hour"|"year"|null
salary_in_kind_only: boolean|null
contract_duration_months: number|null
probation_months: number|null
probation_salary_reduced: boolean|null
working_hours_per_day: number|null
working_days_per_week: number|null
weekly_rest_days: number|null
overtime_rate_defined: boolean|null
accommodation_provided_by_employer: boolean|null
food_provided_by_employer: boolean|null
medical_insurance_provided: boolean|null
ticket_outbound_paid_by_employer: boolean|null
ticket_return_paid_by_employer: boolean|null
passport_held_by_employer: boolean|null
passport_return_on_request_guaranteed: boolean|null
passport_holding_at_worker_request: boolean|null
worker_may_resign: boolean|null
exit_permit_required: boolean|null
recruitment_cost_deducted_from_salary: boolean|null
deduction_clauses: array of strings|null
agency_name: string|null
agency_rl_number: string|null
total_fee_demanded_bdt: number|null
quoted_clauses: object mapping a short topic key to the verbatim sentence|null
extraction_notes: string|null

${FEW_SHOT}

Now extract from the attached document. Return only the JSON object.`;
}

/**
 * Appended on the single retry when the first response was not valid JSON
 * matching the schema (§7.1). Never more than two attempts total.
 */
export function buildRepairPrompt(previousOutput: string, problem: string): string {
  const truncated =
    previousOutput.length > 2000 ? `${previousOutput.slice(0, 2000)}…` : previousOutput;

  return `Your previous response could not be parsed.

Problem: ${problem}

Your previous response was:
${truncated}

Return ONLY a valid JSON object matching the schema exactly. No markdown fences, no
commentary. Every schema field must be present; use null where the document does not
state a value.`;
}
