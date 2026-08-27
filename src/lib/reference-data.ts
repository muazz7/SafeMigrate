import { z } from 'zod';
import agenciesFile from '../../data/agencies.json';
import ceilingsFile from '../../data/cost-ceilings.json';
import wagesFile from '../../data/min-wages.json';
import type { Agency, CostCeiling, DataSourceMeta, MinWage } from '@/types';

/**
 * Static reference data — BUILD-SPEC §5.3.
 *
 * Imported at build time, never stored in Postgres. This is what makes Agency
 * Verifier and Cost Checker work with the radio off on both targets; in the APK
 * these tables are compiled straight into the bundle.
 *
 * Validation runs at module load, so a malformed data file fails the BUILD rather
 * than showing a migrant worker a wrong number at the fair.
 */

const MetaSchema = z.object({
  _STUB: z.string().optional(),
  source: z.string(),
  source_url: z.string().nullable(),
  collected_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'collected_on must be YYYY-MM-DD'),
  note: z.string().nullable(),
});

const AgencySchema = z.object({
  rl_number: z.string().min(1),
  name: z.string().min(1),
  name_bn: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'expired', 'cancelled']),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  district: z.string().nullable(),
  baira_member: z.boolean().nullable(),
});

const CostCeilingSchema = z.object({
  country_code: z.string().length(2),
  country_en: z.string().min(1),
  country_bn: z.string().min(1),
  // null = not known. Must never be coerced to 0, which would flag every fee
  // as a critical overcharge under R02.
  ceiling_bdt: z.number().positive().nullable(),
  actual_avg_bdt: z.number().positive().nullable(),
});

const MinWageSchema = z.object({
  country_code: z.string().length(2),
  country_en: z.string().min(1),
  currency: z.string().min(3),
  min_monthly_local: z.number().positive(),
});

function load<T>(label: string, schema: z.ZodType<T>, file: unknown) {
  const parsed = z
    .object({ meta: MetaSchema, records: z.array(schema) })
    .safeParse(file);

  if (!parsed.success) {
    throw new Error(
      `data/${label}.json failed validation:\n${parsed.error.issues
        .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }

  const { meta, records } = parsed.data;
  if (meta._STUB && process.env.NODE_ENV !== 'test') {
    console.warn(`[data] ${label}.json is STUB data — ${records.length} placeholder rows`);
  }

  return { meta: meta as DataSourceMeta, records, isStub: Boolean(meta._STUB) };
}

export const AGENCIES = load('agencies', AgencySchema, agenciesFile) as {
  meta: DataSourceMeta;
  records: Agency[];
  isStub: boolean;
};

export const COST_CEILINGS = load('cost-ceilings', CostCeilingSchema, ceilingsFile) as {
  meta: DataSourceMeta;
  records: CostCeiling[];
  isStub: boolean;
};

export const MIN_WAGES = load('min-wages', MinWageSchema, wagesFile) as {
  meta: DataSourceMeta;
  records: MinWage[];
  isStub: boolean;
};
