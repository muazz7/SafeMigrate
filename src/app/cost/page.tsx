'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SeverityIcon, SafeIcon } from '@/components/SeverityBadge';
import {
  ceilingForCountry,
  computeOvercharge,
  costCountries,
  costSourceMeta,
  monthsOfSalary,
} from '@/lib/cost';
import { COST_CEILINGS } from '@/lib/reference-data';
import { formatBdt, formatCount, formatMultiple, t } from '@/lib/strings';
import type { CostCeiling } from '@/types';

/**
 * Cost Checker — BUILD-SPEC §10.5.
 *
 * Pure lookup over `data/cost-ceilings.json`, compiled into both bundles. No fetch
 * anywhere on this page: it has to work with the radio off, which is most of the
 * point of shipping an app rather than only a website (§12.1).
 *
 * Deep-linked from a scan result as /cost?country=MY&amount=380000.
 */

const parseAmount = (raw: string | null): number | null => {
  if (!raw) return null;
  const value = Number(raw.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
};

function CostContent() {
  const params = useSearchParams();
  const linkCountry = params.get('country');
  const linkAmount = params.get('amount');
  // Optional: a monthly salary in BDT, so a link can also show what the overcharge
  // costs in months of work.
  const linkSalary = params.get('salary');

  // Keyed on the deep link so arriving from a scan result shows its answer
  // immediately rather than a pre-filled form waiting to be submitted.
  return (
    <CostForm
      key={`${linkCountry ?? ''}:${linkAmount ?? ''}:${linkSalary ?? ''}`}
      initialCountry={linkCountry}
      initialAmount={linkAmount}
      initialSalary={linkSalary}
    />
  );
}

function CostForm({
  initialCountry,
  initialAmount,
  initialSalary,
}: {
  initialCountry: string | null;
  initialAmount: string | null;
  initialSalary: string | null;
}) {
  const countries = costCountries();

  const [countryCode, setCountryCode] = useState(initialCountry ?? '');
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [salary, setSalary] = useState(initialSalary ?? '');
  const [submitted, setSubmitted] = useState(
    initialCountry && initialAmount ? { countryCode: initialCountry, amount: initialAmount } : null,
  );

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitted({ countryCode, amount });
    },
    [countryCode, amount],
  );

  const comparison = useMemo(() => {
    if (!submitted) return null;
    const ceiling = ceilingForCountry(submitted.countryCode);
    const fee = parseAmount(submitted.amount);
    if (!ceiling || fee === null) return null;
    return { ceiling, fee, overcharge: computeOvercharge(fee, ceiling) };
  }, [submitted]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[24px] font-semibold">{t('nav.cost')}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('cost.country_label')}</span>
          <select
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            className="tap focus-ring card px-3 text-[17px] bg-surface"
          >
            <option value="">{t('cost.country_placeholder')}</option>
            {countries.map((country) => (
              <option key={country.country_code} value={country.country_code}>
                {country.country_bn}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('cost.amount_label')}</span>
          <span className="text-muted text-[14px]">{t('cost.amount_hint')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="tap focus-ring card px-3 text-[17px]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t('cost.salary_label')}</span>
          <span className="text-muted text-[14px]">{t('cost.salary_hint')}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={salary}
            onChange={(event) => setSalary(event.target.value)}
            className="tap focus-ring card px-3 text-[17px]"
          />
        </label>

        <button
          type="submit"
          disabled={!countryCode || !amount}
          className="btn-primary focus-ring w-full disabled:opacity-60"
        >
          {t('cost.check_button')}
        </button>
      </form>

      {COST_CEILINGS.isStub ? (
        <p role="note" className="rounded-[12px] bg-high-soft border border-high text-high px-4 py-3 text-[15px]">
          {t('cost.stub_warning')}
        </p>
      ) : null}

      {countries.length < 12 ? (
        <p className="text-muted text-[14px]">
          {t('cost.countries_pending', { count: formatCount(countries.length) })}
        </p>
      ) : null}

      {submitted === null ? (
        <EmptyState />
      ) : comparison === null ? (
        <NoCeilingState />
      ) : comparison.overcharge === null ? (
        <NoCeilingState />
      ) : (
        <Comparison
          ceiling={comparison.ceiling}
          fee={comparison.fee}
          overchargeBdt={comparison.overcharge.overchargeBdt}
          multiple={comparison.overcharge.multiple}
          salaryBdt={parseAmount(salary)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="card p-4">
      <p className="font-semibold">{t('cost.empty_title')}</p>
      <p className="text-muted mt-1">{t('cost.empty_body')}</p>
    </section>
  );
}

/**
 * Shown when we hold no published ceiling for that country. Never guesses and
 * never treats a missing figure as zero, which would report every fee as an
 * infinite overcharge.
 */
function NoCeilingState() {
  return (
    <section className="rounded-[12px] bg-info-soft border border-info p-4 flex flex-col gap-2">
      <p className="font-semibold text-info">{t('cost.no_ceiling_title')}</p>
      <p className="text-ink">{t('cost.no_ceiling_body')}</p>
      <SourceLine />
    </section>
  );
}

function Comparison({
  ceiling,
  fee,
  overchargeBdt,
  multiple,
  salaryBdt,
}: {
  ceiling: CostCeiling;
  fee: number;
  overchargeBdt: number;
  multiple: number;
  salaryBdt: number | null;
}) {
  const over = overchargeBdt > 0;
  const months = over ? monthsOfSalary(overchargeBdt, salaryBdt) : null;

  // Bars are scaled against the largest of the three so the ratio is visible at a
  // glance without reading a single number — the point for a user who reads slowly.
  const largest = Math.max(fee, ceiling.ceiling_bdt ?? 0, ceiling.actual_avg_bdt ?? 0);
  const width = (value: number) => Math.max(3, Math.round((value / largest) * 100));

  return (
    <section className="flex flex-col gap-4">
      <div
        className={`rounded-[12px] border-2 p-4 flex flex-col gap-2 ${
          over ? 'bg-critical-soft border-critical' : 'bg-safe-soft border-safe'
        }`}
      >
        <div className={`flex items-center gap-2.5 ${over ? 'text-critical' : 'text-safe'}`}>
          {over ? <SeverityIcon severity="critical" size={26} /> : <SafeIcon size={26} />}
          <p className="font-semibold text-[19px] leading-snug">
            {over ? t('cost.over_headline') : t('cost.under_headline')}
          </p>
        </div>

        {over ? (
          <>
            <p className="text-critical text-[34px] font-semibold leading-tight">
              {formatBdt(overchargeBdt)}
            </p>
            <p className="font-semibold text-ink">
              {t('result.multiple_of_ceiling', { multiple: formatMultiple(multiple) })}
            </p>
            {months !== null ? (
              <p className="text-ink">
                {t('cost.months_of_salary', { months: formatMultiple(months) })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-ink">{t('cost.under_body')}</p>
        )}
      </div>

      {/* Three bars, plain CSS — no chart library (§10.5). */}
      <div className="card p-4 flex flex-col gap-3">
        <Bar
          label={t('cost.bar_ceiling')}
          value={ceiling.ceiling_bdt}
          width={width(ceiling.ceiling_bdt ?? 0)}
          barClass="bg-safe"
        />
        {ceiling.actual_avg_bdt !== null ? (
          <Bar
            label={t('cost.bar_average')}
            value={ceiling.actual_avg_bdt}
            width={width(ceiling.actual_avg_bdt)}
            barClass="bg-medium"
          />
        ) : (
          <p className="text-muted text-[14px]">{t('cost.no_average')}</p>
        )}
        <Bar
          label={t('cost.bar_yours')}
          value={fee}
          width={width(fee)}
          barClass={over ? 'bg-critical' : 'bg-brand'}
        />

        <SourceLine />
      </div>

      <p className="text-muted text-[15px]">{t('cost.receipt_note')}</p>

      <div className="flex flex-col gap-2">
        <Link
          href={`/vault/complaint?country=${encodeURIComponent(ceiling.country_code)}&amount=${fee}`}
          className="btn-primary focus-ring grid place-items-center"
        >
          {t('cost.cta_complaint')}
        </Link>
        <Link href="/agency" className="btn-secondary focus-ring grid place-items-center">
          {t('cost.cta_verify_agency')}
        </Link>
      </div>
    </section>
  );
}

function Bar({
  label,
  value,
  width,
  barClass,
}: {
  label: string;
  value: number | null;
  width: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex justify-between gap-3 text-[15px]">
        <span className="text-muted">{label}</span>
        <span className="font-semibold">{value === null ? '—' : formatBdt(value)}</span>
      </div>
      <div className="h-3.5 rounded-full bg-border mt-1 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** Citation and collection date on every comparison — non-negotiable (§10.5). */
function SourceLine() {
  const meta = costSourceMeta();
  return (
    <p className="text-muted text-[13px] border-t border-border pt-2">
      {t('cost.source_ceiling', { source: meta.source, date: meta.collected_on })}
    </p>
  );
}

export default function CostPage() {
  return (
    <Suspense fallback={<p className="text-muted py-8 text-center">…</p>}>
      <CostContent />
    </Suspense>
  );
}
