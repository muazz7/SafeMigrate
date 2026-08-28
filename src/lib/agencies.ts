import { AGENCIES } from '@/lib/reference-data';
import type { Agency, AgencyMatch, DataSourceMeta } from '@/types';

/**
 * Agency licence lookup — BUILD-SPEC §10.4.
 *
 * Pure functions over data compiled into the bundle, so this works with the radio
 * off on both targets. No network, ever.
 */

/** Legal-form noise that carries no identifying information. */
const NOISE = [
  'm/s', 'ms', 'messrs',
  'limited', 'ltd', 'pvt', 'private', 'company', 'co',
  'international', 'intl',
  'recruiting', 'recruitment', 'agency', 'agencies',
  'overseas', 'manpower', 'services', 'service', 'enterprise', 'enterprises',
  'trade', 'trading', 'associates', 'corporation', 'corp', 'group',
];

/**
 * Lowercase, strip legal forms and punctuation, collapse whitespace.
 * "M/s. Al-Noor Overseas Ltd." and "AL NOOR overseas limited" must normalise alike.
 */
export function normaliseName(raw: string): string {
  const base = raw
    .toLowerCase()
    .replace(/[.,'"()\-_/\\&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const kept = base.split(' ').filter((word) => word && !NOISE.includes(word));

  // If a name is made entirely of noise words, keep the original rather than
  // reducing it to an empty string that would match everything.
  return kept.length > 0 ? kept.join(' ') : base;
}

/** RL numbers are compared as digits only — formatting varies wildly across sources. */
export const normaliseRl = (raw: string): string => raw.replace(/\D+/g, '');

/** Character bigrams, used for the Dice coefficient below. */
function bigrams(value: string): string[] {
  const clean = value.replace(/\s+/g, '');
  if (clean.length < 2) return [clean];
  const result: string[] = [];
  for (let i = 0; i < clean.length - 1; i += 1) result.push(clean.slice(i, i + 2));
  return result;
}

/**
 * Sørensen–Dice similarity on character bigrams, 0–1.
 *
 * Chosen over edit distance because it tolerates word reordering and dropped words
 * ("Al Noor Overseas" vs "Overseas Al-Noor"), which is how these names actually
 * vary between a contract, a signboard, and the government list.
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const left = bigrams(a);
  const right = bigrams(b);
  if (left.length === 0 || right.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const gram of left) counts.set(gram, (counts.get(gram) ?? 0) + 1);

  let overlap = 0;
  for (const gram of right) {
    const remaining = counts.get(gram) ?? 0;
    if (remaining > 0) {
      overlap += 1;
      counts.set(gram, remaining - 1);
    }
  }

  return (2 * overlap) / (left.length + right.length);
}

const MIN_SIMILARITY = 0.6;
const MAX_RESULTS = 8;

/** Exact RL match after stripping non-digits. */
export function findByRl(rlNumber: string): AgencyMatch | null {
  const target = normaliseRl(rlNumber);
  if (!target) return null;

  const agency = AGENCIES.records.find((record) => normaliseRl(record.rl_number) === target);
  return agency ? { agency, score: 1, matchedOn: 'rl' } : null;
}

/** Fuzzy name match, similarity ≥ 0.6, best first, at most 8 (§10.4). */
export function searchByName(query: string): AgencyMatch[] {
  const target = normaliseName(query);
  if (!target) return [];

  return AGENCIES.records
    .map((agency): AgencyMatch => {
      const byName = similarity(target, normaliseName(agency.name));
      const byBangla = agency.name_bn ? similarity(query.trim(), agency.name_bn.trim()) : 0;
      return { agency, score: Math.max(byName, byBangla), matchedOn: 'name' };
    })
    .filter((match) => match.score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

/**
 * Single entry point used by the Agency Verifier and by the scan pipeline.
 * A query of digits is treated as an RL number; anything else as a name.
 */
export function searchAgencies(query: string): AgencyMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const digits = normaliseRl(trimmed);
  // Treat as an RL number only when the query is essentially all digits.
  if (digits.length >= 4 && digits.length / trimmed.replace(/\s/g, '').length > 0.8) {
    const exact = findByRl(digits);
    if (exact) return [exact];
  }

  return searchByName(trimmed);
}

/** Best single match, or null. Feeds R03. */
export function bestMatch(query: string | null): AgencyMatch | null {
  if (!query) return null;
  return searchAgencies(query)[0] ?? null;
}

export type AgencyState = 'active' | 'expired' | 'suspended' | 'cancelled' | 'not_found';

/**
 * The four states the UI renders (§10.4).
 * An expired `valid_until` overrides a stored status of 'active': the record says
 * the licence lapsed, whatever the status column claims.
 */
export function agencyState(match: AgencyMatch | null, today: string): AgencyState {
  if (!match) return 'not_found';

  const { status, valid_until } = match.agency;
  if (status !== 'active') return status;
  if (valid_until && valid_until < today) return 'expired';
  return 'active';
}

export const isLicenceValid = (match: AgencyMatch | null, today: string): boolean =>
  agencyState(match, today) === 'active';

/** Provenance — shown on every result. Judges will ask how fresh the data is (§10.4). */
export const agencySourceMeta = (): DataSourceMeta => AGENCIES.meta;

export const agencyCount = (): number => AGENCIES.records.length;

export const allAgencies = (): readonly Agency[] => AGENCIES.records;
