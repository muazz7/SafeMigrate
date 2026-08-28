'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Disclaimer } from '@/components/Disclaimer';
import { FlagCard } from '@/components/FlagCard';
import { SeverityIcon, SafeIcon, VERDICT_STYLES } from '@/components/SeverityBadge';
import { SpeakButton, NoVoiceNotice } from '@/components/SpeakButton';
import { loadAnalysis, type StoredAnalysis } from '@/lib/storage';
import { reportSpeech } from '@/lib/tts';
import { formatBdt, formatCount, formatMultiple, t } from '@/lib/strings';
import type { AnalysisResult, Finding } from '@/types';

/**
 * Results — BUILD-SPEC §10.3.
 *
 * Order is fixed by the spec and by what a worried person needs first: the verdict,
 * a way to hear it, the money, the findings, what was NOT checked, then what to do.
 *
 * Query parameter, not a dynamic segment — a static export cannot prerender
 * /scan/[id] (§4.1). useSearchParams must sit inside Suspense.
 */

function ResultContent() {
  const id = useSearchParams().get('id');
  // Derived from the URL rather than set in an effect — with no id there is
  // nothing to load and no reason to render a loading state first.
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>(id ? 'loading' : 'missing');
  const [stored, setStored] = useState<StoredAnalysis | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    void loadAnalysis(id).then((found) => {
      if (!alive) return;
      setStored(found);
      setState(found ? 'ready' : 'missing');
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (state === 'loading') {
    return <p className="text-muted py-8 text-center">…</p>;
  }

  if (state === 'missing' || !stored) {
    return (
      <RecoveryState
        titleKey="result.not_found_title"
        bodyKey="result.not_found_body"
        showTips={false}
      />
    );
  }

  // Nothing could be read at all — never show a half-empty report (§10.3).
  const unreadable = stored.result.checkedCount === 0;
  if (unreadable) {
    return <RecoveryState titleKey="result.failed_title" bodyKey="result.failed_body" showTips />;
  }

  const { result } = stored;
  const warnings = result.findings.filter((f) => f.severity !== 'info');
  const notes = result.findings.filter((f) => f.severity === 'info');
  const overcharge = warnings.find((f) => f.ruleId === 'R02');

  return (
    <div className="flex flex-col gap-5">
      <VerdictBanner result={result} />

      <div className="flex flex-col gap-2">
        <SpeakButton text={reportSpeech(result)} variant="primary" />
        <NoVoiceNotice />
      </div>

      {stored.confidence < 0.6 ? (
        <LowConfidenceNotice />
      ) : null}

      {overcharge ? (
        <OverchargeCard
          finding={overcharge}
          countryCode={stored.contract.workplace_country_code}
        />
      ) : null}

      {warnings.length > 0 ? (
        <section className="flex flex-col gap-3">
          {warnings.map((finding) => (
            <FlagCard key={finding.ruleId} finding={finding} />
          ))}
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section className="flex flex-col gap-3">
          {/* Grouped separately and headed neutrally so an I02 safekeeping note
              can never be mistaken for a warning (§10.3). */}
          <h2 className="font-semibold text-[19px] text-info">{t('result.info_group_heading')}</h2>
          {notes.map((finding) => (
            <FlagCard key={finding.ruleId} finding={finding} />
          ))}
        </section>
      ) : null}

      <CheckedSummary result={result} />

      <NextActions stored={stored} />

      <Disclaimer />
    </div>
  );
}

/** Full-width verdict: colour + icon + the Bangla word + how many things were found. */
function VerdictBanner({ result }: { result: AnalysisResult }) {
  const style = VERDICT_STYLES[result.overallRisk];
  const warnings = result.findings.filter((f) => f.severity !== 'info').length;

  return (
    <section
      aria-live="polite"
      className={`rounded-[12px] border-2 p-4 flex items-center gap-3 ${style.bg} ${style.border} ${style.text}`}
    >
      <span className="shrink-0">
        {result.overallRisk === 'safe' ? (
          <SafeIcon size={34} />
        ) : (
          <SeverityIcon severity={style.icon} size={34} />
        )}
      </span>
      <div>
        <p className="text-[26px] font-semibold leading-tight">
          {t(`verdict.${result.overallRisk}`)}
        </p>
        <p className="text-[15px]">
          {warnings > 0
            ? t('result.verdict_count', { count: formatCount(warnings) })
            : t('result.verdict_none')}
        </p>
      </div>
    </section>
  );
}

/**
 * The headline overcharge number — BUILD-SPEC §10.3.3.
 * This is the screenshot that ends up on the slide, so it is given room: the
 * amount large, and two bars making the ratio visible without reading a number.
 */
function OverchargeCard({
  finding,
  countryCode,
}: {
  finding: Finding;
  countryCode: string | null;
}) {
  const computed = finding.computed ?? {};
  const fee = Number(computed.feeBdt ?? 0);
  const ceiling = Number(computed.ceilingBdt ?? 0);
  const overcharge = Number(computed.overchargeBdt ?? 0);
  const multiple = Number(computed.multiple ?? 0);

  if (!fee || !ceiling) return null;

  const feeWidth = 100;
  const ceilingWidth = Math.max(4, Math.round((ceiling / fee) * 100));

  return (
    <section className="card p-4 flex flex-col gap-3 border-critical border-l-4">
      <p className="text-muted">{t('result.overcharge_headline')}</p>
      <p className="text-critical text-[32px] font-semibold leading-tight">
        {formatBdt(overcharge)}
      </p>
      <p className="text-ink font-semibold">
        {t('result.multiple_of_ceiling', { multiple: formatMultiple(multiple) })}
      </p>

      <dl className="flex flex-col gap-2 mt-1">
        <Bar
          label={t('result.ceiling_label')}
          value={formatBdt(ceiling)}
          width={ceilingWidth}
          className="bg-safe"
        />
        <Bar
          label={t('result.demanded_label')}
          value={formatBdt(fee)}
          width={feeWidth}
          className="bg-critical"
        />
      </dl>

      {/* Deep link into the Cost Checker with the figures already filled in (§14 Day 7). */}
      {countryCode ? (
        <Link
          href={`/cost?country=${encodeURIComponent(countryCode)}&amount=${fee}`}
          className="btn-secondary focus-ring grid place-items-center mt-1"
        >
          {t('result.see_cost_breakdown')}
        </Link>
      ) : null}
    </section>
  );
}

function Bar({
  label,
  value,
  width,
  className,
}: {
  label: string;
  value: string;
  width: number;
  className: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[15px]">
        <dt className="text-muted">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
      {/* Plain CSS, no chart library (§10.5). */}
      <div className="h-3 rounded-full bg-border mt-1 overflow-hidden">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * What was checked and what was not — BUILD-SPEC §10.3.5.
 * Being open about the skipped checks is what stops a partly-readable document
 * from looking like a clean bill of health, and it is the honest answer when a
 * judge asks what the tool does when it cannot see something.
 */
function CheckedSummary({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card p-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="tap focus-ring w-full text-left font-semibold flex items-center justify-between gap-2"
      >
        {t('result.what_was_checked')}
        <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>

      <p className="text-muted mt-1">
        {t('result.checked_summary', {
          checked: formatCount(result.checkedCount),
          skipped: formatCount(result.skippedCount),
        })}
      </p>

      {open ? (
        <p className="text-muted text-[15px] mt-2">{t('rules.I03.explain')}</p>
      ) : null}
    </section>
  );
}

function LowConfidenceNotice() {
  return (
    <section className="rounded-[12px] bg-info-soft border border-info text-info p-4">
      <p className="font-semibold">{t('result.low_confidence_title')}</p>
      <p className="text-ink text-[15px] mt-1">{t('result.low_confidence_body')}</p>
    </section>
  );
}

function NextActions({ stored }: { stored: StoredAnalysis }) {
  const agencyHref = stored.agencyQuery
    ? `/agency?q=${encodeURIComponent(stored.agencyQuery)}`
    : '/agency';

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-[19px]">{t('result.next_actions')}</h2>
      <Link href={agencyHref} className="btn-secondary focus-ring grid place-items-center">
        {t('result.next_verify_agency')}
      </Link>
      <Link
        href={`/vault/complaint?id=${encodeURIComponent(stored.id)}`}
        className="btn-secondary focus-ring grid place-items-center"
      >
        {t('result.next_make_complaint')}
      </Link>
      <Link href="/vault" className="btn-secondary focus-ring grid place-items-center">
        {t('result.next_save_document')}
      </Link>
    </section>
  );
}

/**
 * Recovery for an unreadable document or a missing result — §10.3.
 * Always offers a way forward; never leaves a half-empty report on screen.
 */
function RecoveryState({
  titleKey,
  bodyKey,
  showTips,
}: {
  titleKey: string;
  bodyKey: string;
  showTips: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[12px] bg-high-soft border border-high p-4">
        <p className="font-semibold text-high text-[19px]">{t(titleKey)}</p>
        <p className="text-ink mt-1">{t(bodyKey)}</p>
      </section>

      {showTips ? (
        <div className="card p-4">
          <p className="font-semibold">{t('result.retake')}</p>
          <p className="text-muted mt-1">{t('scan.photo_tips')}</p>
        </div>
      ) : null}

      <Link href="/scan" className="btn-primary focus-ring grid place-items-center">
        {t('result.back_to_scan')}
      </Link>

      <Disclaimer />
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="text-muted py-8 text-center">…</p>}>
      <ResultContent />
    </Suspense>
  );
}
