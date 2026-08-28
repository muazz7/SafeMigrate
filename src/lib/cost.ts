import { COST_CEILINGS, MIN_WAGES } from '@/lib/reference-data';
import type { CostCeiling, DataSourceMeta, MinWage } from '@/types';

/**
 * Cost ceiling and wage-floor lookups — BUILD-SPEC §10.5.
 * Pure, offline, no network on either target.
 */

const upper = (value: string): string => value.trim().toUpperCase();

/** Lookup by ISO-2 country code. */
export function ceilingForCountry(countryCode: string | null): CostCeiling | null {
  if (!countryCode) return null;
  const code = upper(countryCode);
  return COST_CEILINGS.records.find((row) => upper(row.country_code) === code) ?? null;
}

export function minWageForCountry(countryCode: string | null): MinWage | null {
  if (!countryCode) return null;
  const code = upper(countryCode);
  return MIN_WAGES.records.find((row) => upper(row.country_code) === code) ?? null;
}

export interface OverchargeResult {
  feeBdt: number;
  ceilingBdt: number;
  /** Always ≥ 0. Zero means at or under the ceiling. */
  overchargeBdt: number;
  /** Fee as a multiple of the ceiling, e.g. 4.81. */
  multiple: number;
}

/**
 * The overcharge maths behind R02 and the headline card.
 *
 * Returns null when the ceiling is unknown (`ceiling_bdt: null`). A null ceiling
 * must never be treated as zero — that would report every fee as an infinite
 * overcharge and fire R02 as critical on documents we have no data for.
 */
export function computeOvercharge(feeBdt: number | null, ceiling: CostCeiling | null): OverchargeResult | null {
  if (feeBdt === null || feeBdt <= 0) return null;
  if (!ceiling || ceiling.ceiling_bdt === null || ceiling.ceiling_bdt <= 0) return null;

  const ceilingBdt = ceiling.ceiling_bdt;
  return {
    feeBdt,
    ceilingBdt,
    overchargeBdt: Math.max(0, feeBdt - ceilingBdt),
    multiple: Number((feeBdt / ceilingBdt).toFixed(2)),
  };
}

/** Months of salary the overcharge represents — only when currencies allow it. */
export function monthsOfSalary(
  overchargeBdt: number,
  monthlySalaryBdt: number | null,
): number | null {
  if (monthlySalaryBdt === null || monthlySalaryBdt <= 0) return null;
  return Number((overchargeBdt / monthlySalaryBdt).toFixed(1));
}

/** Country list for the picker, in Bangla name order as displayed. */
export const costCountries = (): readonly CostCeiling[] => COST_CEILINGS.records;

export const costSourceMeta = (): DataSourceMeta => COST_CEILINGS.meta;
export const wageSourceMeta = (): DataSourceMeta => MIN_WAGES.meta;
