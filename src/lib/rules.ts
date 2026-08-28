import type { ExtractedContract } from '@/lib/schema';
import type {
  AgencyMatch,
  AnalysisResult,
  CostCeiling,
  Finding,
  MinWage,
  OverallRisk,
  Severity,
  WarningRuleId,
} from '@/types';

/**
 * ⭐ THE RULES ENGINE — BUILD-SPEC §8.
 *
 * Pure functions. Zero I/O, zero async, zero model calls, zero platform
 * dependencies. Runs identically on Vercel, in a browser, and inside the APK.
 *
 * WHY THIS FILE IS SHAPED THIS WAY
 * A judge will ask how we know the AI is not hallucinating violations. The answer
 * has to be visible in the code, not asserted in a slide: the model only ever
 * *reads fields off a page*. It never sees a rule, never learns what counts as a
 * violation, and cannot invent one. Every flag below is decided here, by a
 * human-written condition over those fields, and every one is reproducible from
 * the same input forever.
 *
 * Consequently: no rule may consult the model, the network, the clock, or random
 * numbers. `today` is passed in precisely so that expiry checks stay deterministic
 * and testable.
 */

export interface RuleInput {
  contract: ExtractedContract;
  agencyMatch: AgencyMatch | null;
  costCeiling: CostCeiling | null;
  minWage: MinWage | null;
  userDeclaredFeeBdt: number | null;
  priorOfferSalary: { amount: number; currency: string } | null;
  /** Extraction confidence 0–1, drives I01. Null when unknown. */
  confidence: number | null;
  /** ISO date (YYYY-MM-DD). Injected, never read from the clock — see above. */
  today: string;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

/**
 * The model is deliberately never told about rule ids — teaching it our rules is
 * exactly the coupling this design exists to avoid. It labels quotes with plain
 * topic words instead, so each rule looks up its evidence by topic, and also
 * accepts its own id in case a future prompt emits one.
 */
const EVIDENCE_KEYS: Record<string, string[]> = {
  R01: ['passport'],
  I02: ['passport'],
  R02: ['fee', 'cost', 'payment', 'charge'],
  R03: ['agency', 'licence', 'license'],
  R04: ['salary', 'wage', 'pay'],
  R05: ['deduction', 'recruitment_cost', 'recruitment', 'salary'],
  R06: ['salary', 'offer', 'wage'],
  R07: ['employer', 'job', 'position', 'designation'],
  R08: ['resign', 'exit', 'termination', 'terminate'],
  R09: ['ticket', 'return_ticket', 'travel', 'air_ticket'],
  R10: ['hours', 'working_hours', 'overtime', 'duty'],
  R11: ['probation'],
  R12: ['rest', 'rest_day', 'holiday', 'weekly_rest'],
  R13: ['accommodation', 'food', 'housing', 'meals'],
  R14: ['language'],
};

function evidenceFor(contract: ExtractedContract, ruleId: string): string | null {
  const quotes = contract.quoted_clauses;
  if (!quotes) return null;

  if (typeof quotes[ruleId] === 'string') return quotes[ruleId];

  for (const key of EVIDENCE_KEYS[ruleId] ?? []) {
    const direct = quotes[key];
    if (typeof direct === 'string') return direct;

    // Tolerate "passport_custody", "Passport", "salary_clause", …
    const loose = Object.keys(quotes).find((k) => k.toLowerCase().includes(key));
    if (loose && typeof quotes[loose] === 'string') return quotes[loose];
  }

  return null;
}

const finding = (
  ruleId: WarningRuleId | 'I01' | 'I02' | 'I03',
  severity: Severity,
  contract: ExtractedContract,
  extra?: { computed?: Record<string, string | number>; legalRef?: string },
): Finding => ({
  ruleId,
  severity,
  titleKey: `rules.${ruleId}.title`,
  explainKey: `rules.${ruleId}.explain`,
  actionKey: `rules.${ruleId}.action`,
  evidence: evidenceFor(contract, ruleId),
  ...(extra?.computed ? { computed: extra.computed } : {}),
  ...(extra?.legalRef ? { legalRef: extra.legalRef } : {}),
});

// ---------------------------------------------------------------------------
// Readability guard
// ---------------------------------------------------------------------------

/**
 * Did the model actually read a document?
 *
 * Several rules fire on nulls on purpose — silence about a return ticket is itself
 * the warning (§7.2). But that reasoning only holds for a page that was read. On a
 * blurred photo where every field is null, the same logic would manufacture a
 * fistful of warnings out of nothing, which is both wrong and destroys trust in
 * every other flag on the screen.
 *
 * So: if nothing substantive was extracted, every rule reports "not evaluated",
 * the skipped count climbs, and I01/I03 tell the user to re-photograph. This is a
 * precision fix, not a softening — no rule's severity or condition is weakened
 * (§16.9).
 */
export function isDocumentReadable(contract: ExtractedContract): boolean {
  const anchors: (keyof ExtractedContract)[] = [
    'document_type_detected',
    'employer_name',
    'workplace_country',
    'job_title',
    'salary_amount',
    'contract_duration_months',
    'working_hours_per_day',
    'agency_name',
    'total_fee_demanded_bdt',
    'passport_held_by_employer',
    'worker_may_resign',
    'accommodation_provided_by_employer',
  ];

  return anchors.some((key) => {
    const value = contract[key];
    return value !== null && value !== 'unknown';
  });
}

// ---------------------------------------------------------------------------
// Salary normalisation
// ---------------------------------------------------------------------------

const WEEKS_PER_MONTH = 52 / 12;

/**
 * Converts a stated salary to a monthly figure IN ITS OWN CURRENCY.
 * Never converts between currencies — R04 skips instead (§8.4).
 * Returns null when the period needs schedule data the document does not give.
 */
export function monthlyEquivalent(contract: ExtractedContract): number | null {
  const { salary_amount, salary_period, working_days_per_week, working_hours_per_day } = contract;
  if (salary_amount === null || salary_amount <= 0 || salary_period === null) return null;

  switch (salary_period) {
    case 'month':
      return salary_amount;
    case 'year':
      return salary_amount / 12;
    case 'week':
      return salary_amount * WEEKS_PER_MONTH;
    case 'day':
      if (working_days_per_week === null || working_days_per_week <= 0) return null;
      return salary_amount * working_days_per_week * WEEKS_PER_MONTH;
    case 'hour':
      if (
        working_days_per_week === null || working_days_per_week <= 0 ||
        working_hours_per_day === null || working_hours_per_day <= 0
      ) {
        return null;
      }
      return salary_amount * working_hours_per_day * working_days_per_week * WEEKS_PER_MONTH;
  }
}

/** The fee under test: what the user told us, else what the document demands. */
export const effectiveFeeBdt = (input: RuleInput): number | null =>
  input.userDeclaredFeeBdt ?? input.contract.total_fee_demanded_bdt;

const sameCurrency = (a: string | null, b: string | null): boolean =>
  a !== null && b !== null && a.trim().toUpperCase() === b.trim().toUpperCase();

// ---------------------------------------------------------------------------
// THE RULES
// Each returns a Finding when it fires, or null when it does not.
// Whether a rule *could* be evaluated at all is a separate question, answered by
// the `evaluable` predicate beside it in the registry, which drives skippedCount.
// ---------------------------------------------------------------------------

/**
 * R01 — Passport held by the employer with NO written guarantee of return.
 *
 * CHECKS: custody of the passport is transferred to the employer, sponsor, or
 * agency, and the document does not state in writing that it will be returned on
 * request.
 *
 * WHY IT MATTERS: this is confiscation, and it is the practical reason a worker in
 * distress abroad cannot leave. It is prohibited under the labour law of the
 * destination countries themselves — Saudi Labour Law Article 39 bars employers
 * retaining workers' documents; the ILO ran a joint campaign with Qatar's national
 * anti-trafficking committee specifically to tell workers confiscation is illegal
 * there; and the US State Department's trafficking report lists passport retention
 * first among indicators of labour trafficking in the UAE.
 *
 * NOTE ON TONE, NOT SEVERITY: the practice is extremely common in Bangladesh and
 * employers have a stated reason for it, so the Bangla copy for this rule is
 * deliberately gentler than the others. That is a matter of wording in
 * strings.json. The severity is critical and is set here, in code. Do not let the
 * gentle tone pull the severity down (§8.4, §16.9).
 *
 * `passport_holding_at_worker_request` is surfaced in `computed` for transparency
 * but deliberately does NOT suppress this rule: consent obtained at the point of
 * signing does not make an unreturnable passport returnable.
 */
export function rule01_passportHeldWithoutGuarantee(input: RuleInput): Finding | null {
  const { passport_held_by_employer, passport_return_on_request_guaranteed } = input.contract;

  if (passport_held_by_employer !== true) return null;
  if (passport_return_on_request_guaranteed === true) return null; // → I02, not a warning.

  return finding('R01', 'critical', input.contract, {
    legalRef: 'Overseas Employment and Migrants Act 2013; destination-country labour law',
    computed: {
      atWorkerRequest: input.contract.passport_holding_at_worker_request === true ? 'yes' : 'not stated',
    },
  });
}

/**
 * R02 — Fee above the government ceiling.
 *
 * CHECKS: the amount demanded exceeds the published maximum migration cost for the
 * destination country.
 *
 * WHY IT MATTERS: overcharging is the single most common abuse in Bangladeshi
 * labour migration, and the debt it creates is what traps a worker in a job they
 * would otherwise leave. The overcharge figure is also the number the worker can
 * take to a District Employment and Manpower Office.
 *
 * A null ceiling means we have no published figure for that country — the rule is
 * skipped, never evaluated against zero.
 */
export function rule02_feeAboveCeiling(input: RuleInput): Finding | null {
  const fee = effectiveFeeBdt(input);
  const ceiling = input.costCeiling?.ceiling_bdt ?? null;

  if (fee === null || fee <= 0 || ceiling === null || ceiling <= 0) return null;
  if (fee <= ceiling) return null;

  return finding('R02', 'critical', input.contract, {
    legalRef: 'MoEWOE migration cost circular',
    computed: {
      feeBdt: fee,
      ceilingBdt: ceiling,
      overchargeBdt: fee - ceiling,
      multiple: Number((fee / ceiling).toFixed(2)),
    },
  });
}

/**
 * R03 — Recruiting agency is not licensed, or the licence is not active.
 *
 * CHECKS: the named agency is absent from our copy of the licence list, or its
 * status is not active, or its licence validity date has passed.
 *
 * WHY IT MATTERS: an unlicensed agency is outside the legal recourse system
 * entirely. If the money disappears there is no licence to suspend and no bond to
 * claim against.
 *
 * Skipped when the document names no agency at all — there is nothing to verify,
 * and inventing a "not licensed" critical for a contract that never mentions an
 * agency would be a false alarm, not caution.
 */
export function rule03_agencyNotLicensed(input: RuleInput): Finding | null {
  const named = input.contract.agency_name ?? input.contract.agency_rl_number;
  if (!named && !input.agencyMatch) return null;

  const match = input.agencyMatch;

  if (!match) {
    return finding('R03', 'critical', input.contract, {
      legalRef: 'Overseas Employment and Migrants Act 2013',
      computed: { state: 'not_found' },
    });
  }

  const { status, valid_until } = match.agency;
  const expired = valid_until !== null && valid_until < input.today;

  if (status === 'active' && !expired) return null;

  return finding('R03', 'critical', input.contract, {
    legalRef: 'Overseas Employment and Migrants Act 2013',
    computed: { state: expired && status === 'active' ? 'expired' : status },
  });
}

/**
 * R04 — Salary below the destination country's wage floor.
 *
 * CHECKS: the monthly-normalised salary is below the minimum monthly wage for that
 * country, compared strictly within the same currency.
 *
 * WHY IT MATTERS: a below-floor wage means the arithmetic the worker was sold does
 * not work. It is also frequently the first sign that the contract they signed at
 * home is not the contract waiting for them.
 *
 * Currencies are NEVER converted (§8.4). An exchange rate would be a number we
 * invented, and a wrong one would produce a confident, false critical.
 */
export function rule04_salaryBelowFloor(input: RuleInput): Finding | null {
  const { minWage, contract } = input;
  if (!minWage) return null;
  if (!sameCurrency(contract.salary_currency, minWage.currency)) return null;

  const monthly = monthlyEquivalent(contract);
  if (monthly === null) return null;
  if (monthly >= minWage.min_monthly_local) return null;

  return finding('R04', 'critical', contract, {
    computed: {
      monthlySalary: Number(monthly.toFixed(2)),
      floor: minWage.min_monthly_local,
      currency: minWage.currency,
      shortfall: Number((minWage.min_monthly_local - monthly).toFixed(2)),
    },
  });
}

/**
 * R05 — Recruitment costs deducted from salary (debt bondage).
 *
 * CHECKS: the document states that recruitment or placement costs will be recovered
 * from the worker's wages.
 *
 * WHY IT MATTERS: this is the mechanism of debt bondage. The worker cannot leave
 * because leaving means defaulting on a debt they are working to discharge, which
 * is why it is named as an indicator under the ILO Forced Labour Convention and
 * targeted by SDG 8.7. Employer-paid recruitment is the international standard.
 */
export function rule05_debtBondage(input: RuleInput): Finding | null {
  if (input.contract.recruitment_cost_deducted_from_salary !== true) return null;

  return finding('R05', 'critical', input.contract, {
    legalRef: 'ILO Forced Labour Convention; SDG 8.7',
  });
}

/**
 * R06 — Contract substitution: the salary is lower than the one first offered.
 *
 * CHECKS: the salary in this document is below the figure the worker says they were
 * originally promised, in the same currency.
 *
 * WHY IT MATTERS: substituting a worse contract once the worker has paid and
 * committed is a recognised trafficking indicator. By the time they see it, the
 * money is spent and refusing means losing everything already paid.
 */
export function rule06_contractSubstitution(input: RuleInput): Finding | null {
  const prior = input.priorOfferSalary;
  const { salary_amount, salary_currency } = input.contract;

  if (!prior || salary_amount === null) return null;
  if (!sameCurrency(salary_currency, prior.currency)) return null;
  if (salary_amount >= prior.amount) return null;

  return finding('R06', 'critical', input.contract, {
    computed: {
      promised: prior.amount,
      offered: salary_amount,
      currency: prior.currency,
      shortfall: Number((prior.amount - salary_amount).toFixed(2)),
    },
  });
}

/**
 * R07 — The employer or the job is not specifically identified.
 *
 * CHECKS: the employer is described generically rather than named, or the job title
 * is vague, or no employer is named at all.
 *
 * WHY IT MATTERS: a worker who cannot name their employer before departure cannot
 * verify them, cannot be traced to them, and has no one to complain about. "General
 * worker for a company in Malaysia" is not a job offer, and vagueness here is a
 * standard feature of trafficking recruitment.
 */
export function rule07_employerOrJobVague(input: RuleInput): Finding | null {
  const { employer_specific, job_title_specific, employer_name } = input.contract;

  const vague =
    employer_specific === false || job_title_specific === false || employer_name === null;

  return vague ? finding('R07', 'high', input.contract) : null;
}

/**
 * R08 — The worker cannot resign, or needs an exit permit to leave.
 *
 * CHECKS: the document denies the right to terminate, or requires employer
 * permission to leave the country.
 *
 * WHY IT MATTERS: the ability to walk away is what separates employment from
 * forced labour. Where an exit permit is required, the employer holds a veto over
 * the worker physically leaving.
 */
export function rule08_cannotResign(input: RuleInput): Finding | null {
  const { worker_may_resign, exit_permit_required } = input.contract;

  if (worker_may_resign === false || exit_permit_required === true) {
    return finding('R08', 'high', input.contract);
  }
  return null;
}

/**
 * R09 — No employer-paid return ticket.
 *
 * CHECKS: the document does not state that the employer pays for the journey home.
 * Fires on silence as well as on an explicit no — see below.
 *
 * WHY IT MATTERS: a worker without a guaranteed way home is dependent on their
 * employer's goodwill to leave, and the fare is often more than they can save. A
 * contract that simply never mentions the return journey leaves them in exactly the
 * same position as one that refuses it, which is why silence counts here.
 */
export function rule09_noReturnTicket(input: RuleInput): Finding | null {
  return input.contract.ticket_return_paid_by_employer !== true
    ? finding('R09', 'high', input.contract)
    : null;
}

/**
 * R10 — Excessive hours with no defined overtime rate.
 *
 * CHECKS: more than 48 scheduled hours a week, and no overtime rate written down.
 *
 * WHY IT MATTERS: 48 hours is the ILO standard working week. Beyond it with no
 * agreed rate, the extra hours are effectively unpaid and unbounded — the worker
 * has no figure to hold anyone to.
 */
export function rule10_excessiveHours(input: RuleInput): Finding | null {
  const { working_hours_per_day, working_days_per_week, overtime_rate_defined } = input.contract;
  if (working_hours_per_day === null || working_days_per_week === null) return null;

  const weekly = working_hours_per_day * working_days_per_week;
  if (weekly <= 48 || overtime_rate_defined === true) return null;

  return finding('R10', 'high', input.contract, {
    computed: { weeklyHours: Number(weekly.toFixed(1)) },
  });
}

/**
 * R11 — Unpaid or reduced probation, or an unusually long one.
 *
 * CHECKS: pay is reduced during probation, or probation runs beyond three months.
 *
 * WHY IT MATTERS: a long or underpaid probation is a common way to recover the
 * worker's recruitment cost from them by another name, and it lands in the months
 * when they are most indebted and least able to object.
 */
export function rule11_probation(input: RuleInput): Finding | null {
  const { probation_salary_reduced, probation_months } = input.contract;

  if (probation_salary_reduced === true) return finding('R11', 'medium', input.contract);
  if (probation_months !== null && probation_months > 3) {
    return finding('R11', 'medium', input.contract, { computed: { probationMonths: probation_months } });
  }
  return null;
}

/**
 * R12 — No weekly rest day.
 *
 * CHECKS: zero rest days stated, or a seven-day working week with no rest day
 * mentioned.
 *
 * WHY IT MATTERS: one rest day in seven is the ILO baseline. Its absence is both an
 * immediate health issue and a reliable marker of a workplace that does not intend
 * to observe limits generally.
 */
export function rule12_noWeeklyRest(input: RuleInput): Finding | null {
  const { weekly_rest_days, working_days_per_week } = input.contract;

  if (weekly_rest_days === 0) return finding('R12', 'medium', input.contract);
  if (weekly_rest_days === null && working_days_per_week !== null && working_days_per_week >= 7) {
    return finding('R12', 'medium', input.contract, { computed: { workingDays: working_days_per_week } });
  }
  return null;
}

/**
 * R13 — Accommodation or food not clearly provided.
 *
 * CHECKS: the document does not clearly state that the employer provides both.
 *
 * WHY IT MATTERS: these are usually promised verbally by the recruiter and left out
 * of the paper. If they are not in writing, their cost lands on a wage the worker
 * budgeted without them, in a country where they cannot shop around.
 */
export function rule13_accommodationFood(input: RuleInput): Finding | null {
  const { accommodation_provided_by_employer, food_provided_by_employer } = input.contract;

  return accommodation_provided_by_employer !== true || food_provided_by_employer !== true
    ? finding('R13', 'medium', input.contract)
    : null;
}

/**
 * R14 — The document is in a language the worker probably cannot read.
 *
 * CHECKS: the document language is neither Bangla nor English nor a mix of them.
 *
 * WHY IT MATTERS: a signature on a document the signer cannot read is not informed
 * consent, and the Arabic or Malay version is usually the one that governs in a
 * dispute.
 *
 * Skipped when the language is unknown — "we could not tell" is not evidence of a
 * foreign-language contract.
 */
export function rule14_languageBarrier(input: RuleInput): Finding | null {
  const language = input.contract.document_language;
  if (language === null || language === 'unknown') return null;
  if (language === 'bn' || language === 'en' || language === 'mixed') return null;

  return finding('R14', 'medium', input.contract, { computed: { language } });
}

// ---------------------------------------------------------------------------
// Informational findings — these NEVER raise the overall risk (§8.2)
// ---------------------------------------------------------------------------

/** I01 — Low extraction confidence. Ask for a better photograph. */
export function info01_lowConfidence(input: RuleInput): Finding | null {
  if (input.confidence === null || input.confidence >= 0.6) return null;
  return finding('I01', 'info', input.contract, {
    computed: { confidence: input.confidence },
  });
}

/**
 * I02 — Passport held WITH a written return-on-request guarantee.
 *
 * Documented safekeeping, not confiscation: the worker retains effective control
 * because the document obliges its return on demand. Presented as a neutral note
 * telling the worker to confirm that the return line really is written down and not
 * merely promised aloud.
 *
 * This must never be styled as a warning and never raises the overall risk. It is
 * the counterpart to R01, and the pair is what shows the tool distinguishes a
 * dangerous clause from a benign one rather than flagging every mention of a
 * passport (§8.4).
 */
export function info02_passportSafekeeping(input: RuleInput): Finding | null {
  const { passport_held_by_employer, passport_return_on_request_guaranteed } = input.contract;

  if (passport_held_by_employer !== true) return null;
  if (passport_return_on_request_guaranteed !== true) return null;

  return finding('I02', 'info', input.contract, {
    computed: {
      atWorkerRequest: input.contract.passport_holding_at_worker_request === true ? 'yes' : 'not stated',
    },
  });
}

/** I03 — Too much of the document could not be read to check it properly. */
export function info03_partiallyReadable(skippedCount: number, contract: ExtractedContract): Finding | null {
  if (skippedCount <= 6) return null;
  return finding('I03', 'info', contract, { computed: { skippedCount } });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

interface RuleDef {
  id: WarningRuleId;
  /**
   * Whether the document supplies what this rule needs.
   * Separate from `run` so "did not fire" and "could not be checked" stay
   * distinguishable — the UI reports both, and conflating them would let a missing
   * field masquerade as a clean result (§10.3).
   */
  evaluable: (input: RuleInput) => boolean;
  run: (input: RuleInput) => Finding | null;
}

const has = (value: unknown): boolean => value !== null && value !== undefined;

export const RULES: readonly RuleDef[] = [
  {
    id: 'R01',
    evaluable: (i) => has(i.contract.passport_held_by_employer),
    run: rule01_passportHeldWithoutGuarantee,
  },
  {
    id: 'R02',
    evaluable: (i) => effectiveFeeBdt(i) !== null && has(i.costCeiling?.ceiling_bdt),
    run: rule02_feeAboveCeiling,
  },
  {
    id: 'R03',
    evaluable: (i) => Boolean(i.contract.agency_name ?? i.contract.agency_rl_number) || i.agencyMatch !== null,
    run: rule03_agencyNotLicensed,
  },
  {
    id: 'R04',
    evaluable: (i) =>
      i.minWage !== null &&
      sameCurrency(i.contract.salary_currency, i.minWage.currency) &&
      monthlyEquivalent(i.contract) !== null,
    run: rule04_salaryBelowFloor,
  },
  {
    id: 'R05',
    evaluable: (i) => has(i.contract.recruitment_cost_deducted_from_salary),
    run: rule05_debtBondage,
  },
  {
    id: 'R06',
    evaluable: (i) =>
      i.priorOfferSalary !== null &&
      has(i.contract.salary_amount) &&
      sameCurrency(i.contract.salary_currency, i.priorOfferSalary.currency),
    run: rule06_contractSubstitution,
  },
  {
    id: 'R07',
    evaluable: () => true, // Needs only the readability guard.
    run: rule07_employerOrJobVague,
  },
  {
    id: 'R08',
    evaluable: (i) => has(i.contract.worker_may_resign) || has(i.contract.exit_permit_required),
    run: rule08_cannotResign,
  },
  {
    id: 'R09',
    evaluable: () => true, // Silence is the signal — see the rule's JSDoc.
    run: rule09_noReturnTicket,
  },
  {
    id: 'R10',
    evaluable: (i) => has(i.contract.working_hours_per_day) && has(i.contract.working_days_per_week),
    run: rule10_excessiveHours,
  },
  {
    id: 'R11',
    evaluable: (i) => has(i.contract.probation_salary_reduced) || has(i.contract.probation_months),
    run: rule11_probation,
  },
  {
    id: 'R12',
    evaluable: (i) => has(i.contract.weekly_rest_days) || has(i.contract.working_days_per_week),
    run: rule12_noWeeklyRest,
  },
  {
    id: 'R13',
    evaluable: () => true, // Silence is the signal.
    run: rule13_accommodationFood,
  },
  {
    id: 'R14',
    evaluable: (i) => has(i.contract.document_language) && i.contract.document_language !== 'unknown',
    run: rule14_languageBarrier,
  },
];

export const TOTAL_RULES = RULES.length;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

/** §8.2. `info` findings are excluded by construction — they never raise risk. */
export function overallRisk(findings: readonly Finding[]): OverallRisk {
  const criticals = findings.filter((f) => f.severity === 'critical').length;
  const highs = findings.filter((f) => f.severity === 'high').length;
  const mediums = findings.filter((f) => f.severity === 'medium').length;

  if (criticals > 0) return 'critical';
  if (highs >= 2) return 'high';
  if (highs === 1 || mediums >= 2) return 'caution';
  return 'safe';
}

/**
 * Runs every rule and composes the result.
 *
 * Order of operations matters: the readability guard runs first, so an unreadable
 * document produces skips rather than a screenful of warnings invented from nulls.
 */
export function analyze(input: RuleInput): AnalysisResult {
  const readable = isDocumentReadable(input.contract);

  const findings: Finding[] = [];
  let checkedCount = 0;
  let skippedCount = 0;

  for (const rule of RULES) {
    if (!readable || !rule.evaluable(input)) {
      skippedCount += 1;
      continue;
    }
    checkedCount += 1;
    const result = rule.run(input);
    if (result) findings.push(result);
  }

  // Informational notes, which never affect overallRisk.
  const risk = overallRisk(findings);

  const notes: Finding[] = [];
  const lowConfidence = info01_lowConfidence(input);
  if (lowConfidence) notes.push(lowConfidence);

  if (readable) {
    const safekeeping = info02_passportSafekeeping(input);
    if (safekeeping) notes.push(safekeeping);
  }

  const partial = info03_partiallyReadable(skippedCount, input.contract);
  if (partial) notes.push(partial);

  const all = [...findings, ...notes].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return { findings: all, overallRisk: risk, checkedCount, skippedCount };
}
