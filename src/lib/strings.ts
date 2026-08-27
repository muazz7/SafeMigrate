import stringsFile from '../../data/strings.json';

/**
 * Internationalisation — BUILD-SPEC §11.
 *
 * Bangla is the default. A missing Bangla key falls back to English and is logged,
 * never rendered as a raw key and NEVER machine-translated: inventing Bangla copy
 * for a migrant-safety tool is how you ship a confident, wrong sentence.
 */

export type Lang = 'bn' | 'en';

type StringTree = { [key: string]: string | StringTree };

const TREES: Record<Lang, StringTree> = {
  bn: stringsFile.bn as StringTree,
  en: stringsFile.en as StringTree,
};

/** Keys that fell back to English this session. Surfaced by `reportMissingStrings()`. */
const missing = new Set<string>();

const lookup = (tree: StringTree, path: string): string | null => {
  const segments = path.split('.');
  let node: string | StringTree | undefined = tree;

  for (const segment of segments) {
    if (typeof node !== 'object' || node === null) return null;
    node = node[segment];
  }

  return typeof node === 'string' ? node : null;
};

const interpolate = (template: string, vars?: Record<string, string | number>): string => {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
};

/**
 * Resolve a dot-path key. Falls back bn -> en, then to the key itself as an
 * absolute last resort (which should never reach a user — it means the key is
 * absent from both trees and is a bug to fix, not a string to translate).
 */
export function t(key: string, vars?: Record<string, string | number>, lang: Lang = 'bn'): string {
  const primary = lookup(TREES[lang], key);
  if (primary !== null) return interpolate(primary, vars);

  const fallback = lang === 'bn' ? lookup(TREES.en, key) : null;
  if (fallback !== null) {
    if (!missing.has(key)) {
      missing.add(key);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[strings] missing bn key "${key}" — using English fallback`);
      }
    }
    return interpolate(fallback, vars);
  }

  if (!missing.has(key)) {
    missing.add(key);
    console.warn(`[strings] key "${key}" missing in ALL languages`);
  }
  return key;
}

/** Every key that fell back or failed this session, for MISSING_STRINGS.md. */
export const reportMissingStrings = (): string[] => [...missing].sort();

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

/** 2024 -> ২০২৪ */
export const toBanglaDigits = (input: string | number): string =>
  String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/**
 * Bangladeshi lakh/crore grouping: the last three digits, then pairs.
 * 301010 -> "3,01,010" (NOT the Western "301,010").
 */
export function groupLakhCrore(value: number): string {
  const negative = value < 0;
  const digits = Math.abs(Math.round(value)).toString();

  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }

  return negative ? `-${grouped}` : grouped;
}

/** 301010 -> "৩,০১,০১০ টাকা" in Bangla, "৳3,01,010" in English. */
export function formatBdt(value: number, lang: Lang = 'bn'): string {
  const grouped = groupLakhCrore(value);
  return lang === 'bn' ? `${toBanglaDigits(grouped)} টাকা` : `৳${grouped}`;
}

/** 4.81 -> "৪.৮" — used for "সরকারি সীমার ৪.৮ গুণ". */
export function formatMultiple(value: number, lang: Lang = 'bn'): string {
  const fixed = value.toFixed(1);
  return lang === 'bn' ? toBanglaDigits(fixed) : fixed;
}

/** Plain integers in the reading language (counts, "১৪টি বিষয়"). */
export const formatCount = (value: number, lang: Lang = 'bn'): string =>
  lang === 'bn' ? toBanglaDigits(value) : String(value);
