'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SeverityIcon, SafeIcon } from '@/components/SeverityBadge';
import {
  agencySourceMeta,
  agencyState,
  searchAgencies,
  type AgencyState,
} from '@/lib/agencies';
import { AGENCIES } from '@/lib/reference-data';
import { formatCount, t } from '@/lib/strings';
import type { AgencyMatch } from '@/types';

/**
 * Agency Verifier — BUILD-SPEC §10.4.
 *
 * Runs entirely from `data/agencies.json`, which is compiled into both bundles.
 * There is no fetch on this page at all: it must work with the radio off, on the
 * web after one visit and in the APK always (§12.1). Anything that reached for the
 * network here would break the aeroplane-mode demo.
 *
 * Deep-linked from the results screen as /agency?q=<extracted name>.
 */

const todayIso = (): string => new Date().toISOString().slice(0, 10);

function AgencyContent() {
  const deepLinkQuery = useSearchParams().get('q');

  // Keyed on the deep link so arriving from a scan result — or from a second
  // result with a different agency — remounts with that query already searched,
  // instead of syncing it back into state from an effect.
  return <AgencySearch key={deepLinkQuery ?? ''} initialQuery={deepLinkQuery} />;
}

function AgencySearch({ initialQuery }: { initialQuery: string | null }) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [submitted, setSubmitted] = useState<string | null>(initialQuery);

  const results = useMemo(
    () => (submitted && submitted.trim() ? searchAgencies(submitted) : null),
    [submitted],
  );

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setSubmitted(query);
    },
    [query],
  );

  const today = todayIso();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[24px] font-semibold">{t('nav.agency')}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor="agency-q" className="font-semibold">
          {t('agency.search_label')}
        </label>
        <p className="text-muted text-[15px]">{t('agency.search_hint')}</p>
        <input
          id="agency-q"
          type="search"
          inputMode="text"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('agency.search_placeholder')}
          className="tap focus-ring card px-3 text-[17px]"
        />
        <button type="submit" className="btn-primary focus-ring w-full">
          {t('agency.search_button')}
        </button>
      </form>

      {AGENCIES.isStub ? (
        <p role="note" className="rounded-[12px] bg-high-soft border border-high text-high px-4 py-3 text-[15px]">
          {t('agency.stub_warning')}
        </p>
      ) : null}

      {results === null ? (
        <EmptyState />
      ) : results.length === 0 ? (
        <NotFoundCard />
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-muted">
            {results.length === 1
              ? t('agency.results_one')
              : t('agency.results_many', { count: formatCount(results.length) })}
          </p>
          {results.map((match) => (
            <AgencyCard key={match.agency.rl_number} match={match} today={today} />
          ))}
        </section>
      )}

      <HowToSpot />
    </div>
  );
}

function EmptyState() {
  return (
    <section className="card p-4">
      <p className="font-semibold">{t('agency.empty_title')}</p>
      <p className="text-muted mt-1">{t('agency.empty_body')}</p>
    </section>
  );
}

/**
 * Four visually distinct states (§10.4). Colour is never the only signal: each
 * carries its own icon and its own heading text.
 */
const STATE_STYLE: Record<
  AgencyState,
  { wrap: string; text: string; titleKey: string; bodyKey: string }
> = {
  active: {
    wrap: 'bg-safe-soft border-safe',
    text: 'text-safe',
    titleKey: 'agency.state_active_title',
    bodyKey: 'agency.state_active_body',
  },
  expired: {
    wrap: 'bg-critical-soft border-critical',
    text: 'text-critical',
    titleKey: 'agency.state_expired_title',
    bodyKey: 'agency.state_expired_body',
  },
  suspended: {
    wrap: 'bg-critical-soft border-critical',
    text: 'text-critical',
    titleKey: 'agency.state_suspended_title',
    bodyKey: 'agency.state_suspended_body',
  },
  cancelled: {
    wrap: 'bg-critical-soft border-critical',
    text: 'text-critical',
    titleKey: 'agency.state_cancelled_title',
    bodyKey: 'agency.state_cancelled_body',
  },
  not_found: {
    wrap: 'bg-high-soft border-high',
    text: 'text-high',
    titleKey: 'agency.state_not_found_title',
    bodyKey: 'agency.state_not_found_body',
  },
};

function AgencyCard({ match, today }: { match: AgencyMatch; today: string }) {
  const state = agencyState(match, today);
  const style = STATE_STYLE[state];
  const { agency } = match;
  const isActive = state === 'active';

  return (
    <article className={`rounded-[12px] border-2 p-4 flex flex-col gap-3 ${style.wrap}`}>
      <header className="flex items-start gap-2.5">
        <span className={`shrink-0 mt-0.5 ${style.text}`}>
          {isActive ? <SafeIcon size={26} /> : <SeverityIcon severity="critical" size={26} />}
        </span>
        <div>
          <p className={`font-semibold text-[19px] leading-snug ${style.text}`}>
            {t(style.titleKey)}
          </p>
          {!isActive ? (
            <p className={`font-semibold ${style.text}`}>{t('agency.stop_before_paying')}</p>
          ) : null}
        </div>
      </header>

      <p className="selectable text-ink font-semibold text-[19px]">
        {agency.name_bn ?? agency.name}
      </p>

      <dl className="flex flex-col gap-1 text-[15px]">
        <Row label={t('agency.rl_number')} value={agency.rl_number} />
        {agency.valid_until ? (
          <Row label={t('agency.valid_until')} value={agency.valid_until} />
        ) : null}
        {agency.district ? <Row label={t('agency.district')} value={agency.district} /> : null}
        <Row
          label="BAIRA"
          value={
            agency.baira_member === true
              ? t('agency.baira_member')
              : agency.baira_member === false
                ? t('agency.baira_not_member')
                : t('agency.baira_unknown')
          }
        />
      </dl>

      <p className="text-ink">{t(style.bodyKey)}</p>

      {/* §10.4: an active status must not be read as a clean bill of health. */}
      {isActive ? (
        <p className="text-muted text-[15px] bg-surface rounded-[12px] px-3 py-2.5">
          {t('agency.licence_alone_warning')}
        </p>
      ) : null}

      <p className="text-muted text-[14px]">{t('agency.verify_in_person')}</p>

      <SourceLine />
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="selectable font-semibold text-right">{value}</dd>
    </div>
  );
}

function NotFoundCard() {
  const style = STATE_STYLE.not_found;

  return (
    <article className={`rounded-[12px] border-2 p-4 flex flex-col gap-3 ${style.wrap}`}>
      <header className="flex items-start gap-2.5">
        <span className={`shrink-0 mt-0.5 ${style.text}`}>
          <SeverityIcon severity="high" size={26} />
        </span>
        <p className={`font-semibold text-[19px] leading-snug ${style.text}`}>
          {t(style.titleKey)}
        </p>
      </header>

      {/* Carefully worded: absence from our copy is not proof of fraud, but it is
          a serious reason to stop and check in person (§10.4, §16.8). */}
      <p className="text-ink">{t(style.bodyKey)}</p>

      <p className="text-ink bg-surface rounded-[12px] px-3 py-2.5">
        {t('agency.not_found_action')}
      </p>

      <SourceLine />
    </article>
  );
}

/** Provenance on every result card. Judges will ask how fresh the data is (§10.4). */
function SourceLine() {
  const meta = agencySourceMeta();
  return (
    <p className="text-muted text-[13px] border-t border-border pt-2">
      {t('agency.source_line', { source: meta.source, date: meta.collected_on })}
    </p>
  );
}

/** Static guidance — BUILD-SPEC §10.4. Never claims to detect fraud (§16.8). */
function HowToSpot() {
  const legit = ['1', '2', '3', '4', '5', '6', '7'];
  const fraud = ['1', '2', '3', '4', '5', '6', '7', '8'];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-[19px]">{t('agency.how_to_spot_heading')}</h2>

      <div className="card p-4">
        <h3 className="font-semibold text-safe flex items-center gap-2">
          <SafeIcon size={20} />
          {t('agency.legit_heading')}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {legit.map((key) => (
            <li key={key} className="flex gap-2 text-[15px]">
              <span aria-hidden className="text-safe">
                ✓
              </span>
              <span>{t(`agency.legit.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-critical flex items-center gap-2">
          <SeverityIcon severity="critical" size={20} />
          {t('agency.fraud_heading')}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {fraud.map((key) => (
            <li key={key} className="flex gap-2 text-[15px]">
              <span aria-hidden className="text-critical">
                !
              </span>
              <span>{t(`agency.fraud.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-muted text-[14px]">{t('agency.checklist_note')}</p>
    </section>
  );
}

export default function AgencyPage() {
  return (
    <Suspense fallback={<p className="text-muted py-8 text-center">…</p>}>
      <AgencyContent />
    </Suspense>
  );
}
