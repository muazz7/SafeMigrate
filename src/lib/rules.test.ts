import { describe, expect, it } from 'vitest';
import { emptyContract, type ExtractedContract } from '@/lib/schema';
import { analyze, overallRisk, monthlyEquivalent, type RuleInput } from '@/lib/rules';
import type { AgencyMatch, CostCeiling, Finding, MinWage } from '@/types';

/**
 * Rules engine tests — BUILD-SPEC §8.5. The only tests in the project.
 *
 * All fixtures are synthetic; none depend on samples/ or on real reference data.
 */

const TODAY = '2026-08-28';

/** Enough anchor fields to pass the readability guard, and otherwise inert. */
const readableBase = (): ExtractedContract => ({
  ...emptyContract(),
  document_language: 'en',
  document_type_detected: 'contract',
  employer_name: 'Specific Employer Sdn Bhd',
  employer_specific: true,
  job_title: 'Welder',
  job_title_specific: true,
  workplace_country: 'Malaysia',
  workplace_country_code: 'MY',
  salary_amount: 2000,
  salary_currency: 'MYR',
  salary_period: 'month',
  ticket_return_paid_by_employer: true,
  accommodation_provided_by_employer: true,
  food_provided_by_employer: true,
});

const input = (contract: ExtractedContract, over: Partial<RuleInput> = {}): RuleInput => ({
  contract,
  agencyMatch: null,
  costCeiling: null,
  minWage: null,
  userDeclaredFeeBdt: null,
  priorOfferSalary: null,
  confidence: 0.9,
  today: TODAY,
  ...over,
});

const ids = (findings: readonly Finding[]): string[] => findings.map((f) => f.ruleId);
const fired = (contract: ExtractedContract, over: Partial<RuleInput> = {}): string[] =>
  ids(analyze(input(contract, over)).findings);

const agency = (over: Partial<AgencyMatch['agency']> = {}): AgencyMatch => ({
  agency: {
    rl_number: '1234',
    name: 'Test Agency',
    name_bn: null,
    status: 'active',
    valid_until: '2030-01-01',
    district: null,
    baira_member: true,
    ...over,
  },
  score: 1,
  matchedOn: 'rl',
});

const ceiling = (bdt: number | null): CostCeiling => ({
  country_code: 'MY',
  country_en: 'Malaysia',
  country_bn: 'মালয়েশিয়া',
  ceiling_bdt: bdt,
  actual_avg_bdt: null,
});

const wage = (amount: number, currency = 'MYR'): MinWage => ({
  country_code: 'MY',
  country_en: 'Malaysia',
  currency,
  min_monthly_local: amount,
});

// ===========================================================================
// R01 / I02 — the passport split. All three branches are required (§8.5).
// ===========================================================================

describe('R01/I02 — passport handling', () => {
  it('branch 1: held with NO written return guarantee → R01 critical', () => {
    const contract = { ...readableBase(), passport_held_by_employer: true };
    const result = analyze(input(contract));

    const r01 = result.findings.find((f) => f.ruleId === 'R01');
    expect(r01).toBeDefined();
    expect(r01?.severity).toBe('critical');
    expect(ids(result.findings)).not.toContain('I02');
    expect(result.overallRisk).toBe('critical');
  });

  it('branch 1: an explicit `false` guarantee is still confiscation', () => {
    const contract = {
      ...readableBase(),
      passport_held_by_employer: true,
      passport_return_on_request_guaranteed: false,
    };
    expect(fired(contract)).toContain('R01');
  });

  it('branch 2: held WITH a written guarantee → I02 info, no R01, risk unaffected', () => {
    const contract = {
      ...readableBase(),
      passport_held_by_employer: true,
      passport_return_on_request_guaranteed: true,
    };
    const result = analyze(input(contract));

    const i02 = result.findings.find((f) => f.ruleId === 'I02');
    expect(i02).toBeDefined();
    expect(i02?.severity).toBe('info');
    expect(ids(result.findings)).not.toContain('R01');

    // The note must not push the verdict up — this is the whole point of the split.
    expect(result.overallRisk).toBe('safe');
  });

  it('branch 3: passport not mentioned → neither R01 nor I02', () => {
    const found = fired(readableBase());
    expect(found).not.toContain('R01');
    expect(found).not.toContain('I02');
  });

  it('consent at signing does not downgrade confiscation to safekeeping', () => {
    // Holding "at the worker's request" without a written return line is still R01.
    const contract = {
      ...readableBase(),
      passport_held_by_employer: true,
      passport_holding_at_worker_request: true,
    };
    const found = fired(contract);
    expect(found).toContain('R01');
    expect(found).not.toContain('I02');
  });

  it('attaches the passport clause as evidence to both R01 and I02', () => {
    const quote = 'The Employer shall retain the passport of the Employee.';

    const confiscation = analyze(
      input({
        ...readableBase(),
        passport_held_by_employer: true,
        quoted_clauses: { passport: quote },
      }),
    );
    expect(confiscation.findings.find((f) => f.ruleId === 'R01')?.evidence).toBe(quote);

    const safekeeping = analyze(
      input({
        ...readableBase(),
        passport_held_by_employer: true,
        passport_return_on_request_guaranteed: true,
        quoted_clauses: { passport: quote },
      }),
    );
    expect(safekeeping.findings.find((f) => f.ruleId === 'I02')?.evidence).toBe(quote);
  });
});

// ===========================================================================
// One "fires" and one "missing data" test per rule (§8.5)
// ===========================================================================

describe('R02 — fee above the government ceiling', () => {
  it('fires and computes the overcharge', () => {
    const result = analyze(
      input(readableBase(), { userDeclaredFeeBdt: 380000, costCeiling: ceiling(78990) }),
    );
    const r02 = result.findings.find((f) => f.ruleId === 'R02');

    expect(r02?.severity).toBe('critical');
    expect(r02?.computed).toMatchObject({
      feeBdt: 380000,
      ceilingBdt: 78990,
      overchargeBdt: 301010,
      multiple: 4.81,
    });
  });

  it('prefers the user-declared fee over the document figure', () => {
    const contract = { ...readableBase(), total_fee_demanded_bdt: 50000 };
    const result = analyze(
      input(contract, { userDeclaredFeeBdt: 400000, costCeiling: ceiling(78990) }),
    );
    expect(result.findings.find((f) => f.ruleId === 'R02')?.computed?.feeBdt).toBe(400000);
  });

  it('does not fire at or below the ceiling', () => {
    expect(
      fired(readableBase(), { userDeclaredFeeBdt: 78990, costCeiling: ceiling(78990) }),
    ).not.toContain('R02');
  });

  it('SKIPS when the ceiling is unknown — never treats null as a zero ceiling', () => {
    const result = analyze(
      input(readableBase(), { userDeclaredFeeBdt: 380000, costCeiling: ceiling(null) }),
    );
    expect(ids(result.findings)).not.toContain('R02');
  });

  it('skips when no fee is known', () => {
    expect(fired(readableBase(), { costCeiling: ceiling(78990) })).not.toContain('R02');
  });
});

describe('R03 — agency licence', () => {
  const named = (): ExtractedContract => ({ ...readableBase(), agency_name: 'Test Agency' });

  it('fires when a named agency is not in the licence list', () => {
    expect(fired(named(), { agencyMatch: null })).toContain('R03');
  });

  it('fires when the licence is suspended', () => {
    expect(fired(named(), { agencyMatch: agency({ status: 'suspended' }) })).toContain('R03');
  });

  it('fires when the licence has expired by date even if the status says active', () => {
    const result = analyze(
      input(named(), { agencyMatch: agency({ status: 'active', valid_until: '2020-01-01' }) }),
    );
    expect(result.findings.find((f) => f.ruleId === 'R03')?.computed?.state).toBe('expired');
  });

  it('does not fire for an active, in-date licence', () => {
    expect(fired(named(), { agencyMatch: agency() })).not.toContain('R03');
  });

  it('skips when the document names no agency at all', () => {
    expect(fired(readableBase(), { agencyMatch: null })).not.toContain('R03');
  });
});

describe('R04 — salary below the wage floor', () => {
  it('fires in the same currency', () => {
    const contract = { ...readableBase(), salary_amount: 900, salary_currency: 'MYR' };
    expect(fired(contract, { minWage: wage(1700) })).toContain('R04');
  });

  it('normalises other pay periods to monthly', () => {
    const yearly = { ...readableBase(), salary_amount: 6000, salary_period: 'year' as const };
    expect(fired(yearly, { minWage: wage(1700) })).toContain('R04'); // 500/month
  });

  it('SKIPS across currencies rather than converting', () => {
    const contract = { ...readableBase(), salary_amount: 900, salary_currency: 'SAR' };
    expect(fired(contract, { minWage: wage(1700, 'MYR') })).not.toContain('R04');
  });

  it('skips when no wage floor is known', () => {
    const contract = { ...readableBase(), salary_amount: 100 };
    expect(fired(contract, { minWage: null })).not.toContain('R04');
  });

  it('skips a daily rate when the working week is unknown', () => {
    const daily = {
      ...readableBase(),
      salary_amount: 40,
      salary_period: 'day' as const,
      working_days_per_week: null,
    };
    expect(monthlyEquivalent(daily)).toBeNull();
    expect(fired(daily, { minWage: wage(1700) })).not.toContain('R04');
  });
});

describe('R05 — debt bondage', () => {
  it('fires when recruitment costs come out of wages', () => {
    expect(
      fired({ ...readableBase(), recruitment_cost_deducted_from_salary: true }),
    ).toContain('R05');
  });

  it('skips when the document is silent', () => {
    expect(fired(readableBase())).not.toContain('R05');
  });
});

describe('R06 — contract substitution', () => {
  it('fires when the salary is below the earlier offer', () => {
    const contract = { ...readableBase(), salary_amount: 1200, salary_currency: 'MYR' };
    expect(fired(contract, { priorOfferSalary: { amount: 2000, currency: 'MYR' } })).toContain('R06');
  });

  it('does not fire when the salary matches or exceeds the offer', () => {
    const contract = { ...readableBase(), salary_amount: 2000, salary_currency: 'MYR' };
    expect(fired(contract, { priorOfferSalary: { amount: 2000, currency: 'MYR' } })).not.toContain('R06');
  });

  it('skips across currencies', () => {
    const contract = { ...readableBase(), salary_amount: 1200, salary_currency: 'MYR' };
    expect(fired(contract, { priorOfferSalary: { amount: 2000, currency: 'SAR' } })).not.toContain('R06');
  });

  it('skips when no prior offer was given', () => {
    expect(fired(readableBase())).not.toContain('R06');
  });
});

describe('R07 — employer or job vague', () => {
  it('fires on a generic employer', () => {
    expect(fired({ ...readableBase(), employer_specific: false })).toContain('R07');
  });

  it('fires on a vague job title', () => {
    expect(fired({ ...readableBase(), job_title_specific: false })).toContain('R07');
  });

  it('fires when no employer is named', () => {
    expect(fired({ ...readableBase(), employer_name: null })).toContain('R07');
  });

  it('does not fire when both are specific', () => {
    expect(fired(readableBase())).not.toContain('R07');
  });
});

describe('R08 — cannot resign / exit permit', () => {
  it('fires when resignation is denied', () => {
    expect(fired({ ...readableBase(), worker_may_resign: false })).toContain('R08');
  });

  it('fires when an exit permit is required', () => {
    expect(fired({ ...readableBase(), exit_permit_required: true })).toContain('R08');
  });

  it('skips when the document is silent on both', () => {
    expect(fired(readableBase())).not.toContain('R08');
  });
});

describe('R09 — no return ticket', () => {
  it('fires on an explicit refusal', () => {
    expect(fired({ ...readableBase(), ticket_return_paid_by_employer: false })).toContain('R09');
  });

  it('fires on silence — the worker is stranded either way', () => {
    expect(fired({ ...readableBase(), ticket_return_paid_by_employer: null })).toContain('R09');
  });

  it('does not fire when the employer pays', () => {
    expect(fired(readableBase())).not.toContain('R09');
  });
});

describe('R10 — excessive hours with undefined overtime', () => {
  it('fires above 48 hours with no overtime rate', () => {
    const contract = {
      ...readableBase(),
      working_hours_per_day: 10,
      working_days_per_week: 6,
      overtime_rate_defined: false,
    };
    const result = analyze(input(contract));
    expect(result.findings.find((f) => f.ruleId === 'R10')?.computed?.weeklyHours).toBe(60);
  });

  it('does not fire when an overtime rate is defined', () => {
    const contract = {
      ...readableBase(),
      working_hours_per_day: 10,
      working_days_per_week: 6,
      overtime_rate_defined: true,
    };
    expect(fired(contract)).not.toContain('R10');
  });

  it('does not fire at exactly 48 hours', () => {
    const contract = { ...readableBase(), working_hours_per_day: 8, working_days_per_week: 6 };
    expect(fired(contract)).not.toContain('R10');
  });

  it('skips when the schedule is unknown', () => {
    expect(fired(readableBase())).not.toContain('R10');
  });
});

describe('R11 — probation', () => {
  it('fires on reduced probation pay', () => {
    expect(fired({ ...readableBase(), probation_salary_reduced: true })).toContain('R11');
  });

  it('fires when probation runs beyond three months', () => {
    expect(fired({ ...readableBase(), probation_months: 6 })).toContain('R11');
  });

  it('does not fire on a normal probation', () => {
    expect(fired({ ...readableBase(), probation_months: 3 })).not.toContain('R11');
  });

  it('skips when probation is not mentioned', () => {
    expect(fired(readableBase())).not.toContain('R11');
  });
});

describe('R12 — no weekly rest day', () => {
  it('fires on zero rest days', () => {
    expect(fired({ ...readableBase(), weekly_rest_days: 0 })).toContain('R12');
  });

  it('fires on a seven-day week with no rest day stated', () => {
    expect(fired({ ...readableBase(), working_days_per_week: 7 })).toContain('R12');
  });

  it('does not fire with a rest day', () => {
    expect(fired({ ...readableBase(), weekly_rest_days: 1 })).not.toContain('R12');
  });

  it('skips when neither field is known', () => {
    expect(fired(readableBase())).not.toContain('R12');
  });
});

describe('R13 — accommodation and food', () => {
  it('fires when food is not provided', () => {
    expect(fired({ ...readableBase(), food_provided_by_employer: false })).toContain('R13');
  });

  it('fires on silence', () => {
    expect(fired({ ...readableBase(), accommodation_provided_by_employer: null })).toContain('R13');
  });

  it('does not fire when both are provided', () => {
    expect(fired(readableBase())).not.toContain('R13');
  });
});

describe('R14 — language barrier', () => {
  it('fires on Arabic', () => {
    expect(fired({ ...readableBase(), document_language: 'ar' })).toContain('R14');
  });

  it('does not fire on Bangla, English, or mixed', () => {
    for (const lang of ['bn', 'en', 'mixed'] as const) {
      expect(fired({ ...readableBase(), document_language: lang })).not.toContain('R14');
    }
  });

  it('skips when the language could not be determined', () => {
    expect(fired({ ...readableBase(), document_language: 'unknown' })).not.toContain('R14');
  });
});

// ===========================================================================
// Informational findings
// ===========================================================================

describe('informational findings never raise the overall risk', () => {
  it('I01 fires below 0.6 confidence and leaves the verdict safe', () => {
    const result = analyze(input(readableBase(), { confidence: 0.4 }));
    expect(ids(result.findings)).toContain('I01');
    expect(result.overallRisk).toBe('safe');
  });

  it('I01 does not fire at or above 0.6', () => {
    expect(fired(readableBase(), { confidence: 0.6 })).not.toContain('I01');
  });

  it('I03 fires when more than six checks were skipped', () => {
    const result = analyze(input(emptyContract()));
    expect(result.skippedCount).toBeGreaterThan(6);
    expect(ids(result.findings)).toContain('I03');
  });

  it('a pile of info findings still yields a safe verdict', () => {
    const contract = {
      ...readableBase(),
      passport_held_by_employer: true,
      passport_return_on_request_guaranteed: true,
    };
    const result = analyze(input(contract, { confidence: 0.3 }));

    expect(result.findings.every((f) => f.severity === 'info')).toBe(true);
    expect(result.overallRisk).toBe('safe');
  });
});

// ===========================================================================
// Overall risk thresholds (§8.2)
// ===========================================================================

describe('overallRisk', () => {
  const f = (severity: Finding['severity']): Finding => ({
    ruleId: 'R09',
    severity,
    titleKey: '',
    explainKey: '',
    actionKey: '',
    evidence: null,
  });

  it('any critical → critical', () => {
    expect(overallRisk([f('critical'), f('medium')])).toBe('critical');
  });

  it('two highs → high', () => {
    expect(overallRisk([f('high'), f('high')])).toBe('high');
  });

  it('one high → caution', () => {
    expect(overallRisk([f('high')])).toBe('caution');
  });

  it('two mediums → caution', () => {
    expect(overallRisk([f('medium'), f('medium')])).toBe('caution');
  });

  it('one medium → safe', () => {
    expect(overallRisk([f('medium')])).toBe('safe');
  });

  it('nothing → safe', () => {
    expect(overallRisk([])).toBe('safe');
  });
});

// ===========================================================================
// Integration (§8.5)
// ===========================================================================

describe('integration', () => {
  it('golden bad contract → at least 6 findings, critical verdict', () => {
    const bad: ExtractedContract = {
      ...emptyContract(),
      document_language: 'en',
      document_type_detected: 'contract',
      employer_name: null,
      employer_specific: false,
      workplace_country: 'Malaysia',
      workplace_country_code: 'MY',
      job_title: 'General Worker',
      job_title_specific: false,
      salary_amount: 900,
      salary_currency: 'MYR',
      salary_period: 'month',
      probation_months: 6,
      probation_salary_reduced: true,
      working_hours_per_day: 10,
      working_days_per_week: 6,
      weekly_rest_days: 0,
      overtime_rate_defined: false,
      accommodation_provided_by_employer: true,
      food_provided_by_employer: false,
      ticket_outbound_paid_by_employer: true,
      ticket_return_paid_by_employer: null,
      passport_held_by_employer: true,
      passport_return_on_request_guaranteed: null,
      worker_may_resign: false,
      exit_permit_required: true,
      recruitment_cost_deducted_from_salary: true,
      agency_name: 'Unlisted Agency',
      total_fee_demanded_bdt: 380000,
    };

    const result = analyze(
      input(bad, {
        agencyMatch: null,
        costCeiling: ceiling(78990),
        minWage: wage(1700),
        confidence: 0.85,
      }),
    );

    expect(result.findings.length).toBeGreaterThanOrEqual(6);
    expect(result.overallRisk).toBe('critical');

    // The five criticals this document should produce.
    for (const id of ['R01', 'R02', 'R03', 'R04', 'R05']) {
      expect(ids(result.findings)).toContain(id);
    }

    // Findings are ordered most severe first for the results screen (§10.3).
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings.at(-1)?.severity).not.toBe('critical');
  });

  it('golden clean contract → no warnings, I02 note present, safe verdict', () => {
    const clean: ExtractedContract = {
      ...emptyContract(),
      document_language: 'bn',
      document_type_detected: 'contract',
      employer_name: 'Al-Faisal Construction Co.',
      employer_specific: true,
      workplace_country: 'Malaysia',
      workplace_country_code: 'MY',
      job_title: 'Site Welder',
      job_title_specific: true,
      salary_amount: 2500,
      salary_currency: 'MYR',
      salary_period: 'month',
      contract_duration_months: 24,
      probation_months: 3,
      probation_salary_reduced: false,
      working_hours_per_day: 8,
      working_days_per_week: 5,
      weekly_rest_days: 2,
      overtime_rate_defined: true,
      accommodation_provided_by_employer: true,
      food_provided_by_employer: true,
      medical_insurance_provided: true,
      ticket_outbound_paid_by_employer: true,
      ticket_return_paid_by_employer: true,
      passport_held_by_employer: true,
      passport_return_on_request_guaranteed: true,
      worker_may_resign: true,
      exit_permit_required: false,
      recruitment_cost_deducted_from_salary: false,
      agency_name: 'Test Agency',
      total_fee_demanded_bdt: 78990,
      quoted_clauses: {
        passport: 'The passport shall be returned to the Employee upon request at any time.',
      },
    };

    const result = analyze(
      input(clean, {
        agencyMatch: agency(),
        costCeiling: ceiling(78990),
        minWage: wage(1700),
        confidence: 0.95,
      }),
    );

    const warnings = result.findings.filter((f) => f.severity !== 'info');
    expect(warnings).toHaveLength(0);
    expect(ids(result.findings)).toEqual(['I02']);
    expect(result.overallRisk).toBe('safe');

    // 13 of 14 checked. R06 is skipped because the user gave no prior offer to
    // compare against — an honest "not checked", not a silent pass.
    expect(result.checkedCount).toBe(13);
    expect(result.skippedCount).toBe(1);
  });

  it('empty contract → no warnings, everything skipped', () => {
    const result = analyze(input(emptyContract(), { confidence: null }));

    const warnings = result.findings.filter((f) => f.severity !== 'info');
    expect(warnings).toHaveLength(0);

    // Nothing was readable, so nothing was checked — the count must say so rather
    // than letting an unread document look like a clean one.
    expect(result.checkedCount).toBe(0);
    expect(result.skippedCount).toBe(14);
    expect(result.overallRisk).toBe('safe');
    expect(ids(result.findings)).toContain('I03');
  });

  it('checked and skipped always account for all 14 rules', () => {
    for (const contract of [emptyContract(), readableBase()]) {
      const result = analyze(input(contract));
      expect(result.checkedCount + result.skippedCount).toBe(14);
    }
  });
});
