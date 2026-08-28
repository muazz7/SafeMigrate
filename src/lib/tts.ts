import { platform } from '@/lib/platform';
import { t, formatCount, type Lang } from '@/lib/strings';
import type { AnalysisResult, Finding } from '@/types';

/**
 * Speech composition — BUILD-SPEC §10.3.
 *
 * The engines themselves live in `platform.ts` (native Android TTS vs the browser's
 * speechSynthesis, §9). This module only decides WHAT is read aloud, so the same
 * words are spoken on both targets.
 *
 * Reading the report aloud is not an accessibility extra here: the primary user
 * reads Bangla slowly and may not read at all, and the whole point of the app is
 * that they understand what they are about to sign.
 */

/** Full stops give the engine somewhere to breathe between items. */
const sentence = (value: string): string => (/[।.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}।`);

const join = (parts: (string | null)[]): string =>
  parts.filter((p): p is string => Boolean(p && p.trim())).map(sentence).join(' ');

/** One finding: its title, then the explanation, then what to do. */
export function findingSpeech(finding: Finding, lang: Lang = 'bn'): string {
  return join([
    t(finding.titleKey, undefined, lang),
    t(finding.explainKey, undefined, lang),
    t(finding.actionKey, undefined, lang),
  ]);
}

/**
 * The whole report: the verdict and its count, then every finding in the order
 * they appear on screen, so listening matches reading.
 */
export function reportSpeech(result: AnalysisResult, lang: Lang = 'bn'): string {
  const warnings = result.findings.filter((f) => f.severity !== 'info');

  const verdict = t(`verdict.${result.overallRisk}`, undefined, lang);
  const count =
    warnings.length > 0
      ? t('result.verdict_count', { count: formatCount(warnings.length, lang) }, lang)
      : t('result.verdict_none', undefined, lang);

  return join([verdict, count, ...result.findings.map((f) => findingSpeech(f, lang))]);
}

/**
 * Whether the device can speak the language at all.
 *
 * Cached because the web path waits on `voiceschanged`, and re-checking on every
 * render would stall the results screen. Per §15, a device with no Bangla voice
 * hides the speak button rather than offering one that silently does nothing.
 */
let availability: Promise<boolean> | null = null;

export function canSpeak(): Promise<boolean> {
  availability ??= platform.canSpeak().catch(() => false);
  return availability;
}

/** Test seam and a way to re-check after the user installs a voice. */
export const resetSpeechAvailability = (): void => {
  availability = null;
};
