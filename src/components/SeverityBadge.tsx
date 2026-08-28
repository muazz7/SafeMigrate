import { t } from '@/lib/strings';
import type { OverallRisk, Severity } from '@/types';

/**
 * Severity indicator — BUILD-SPEC §6 (accessibility, non-negotiable).
 *
 * Severity is NEVER conveyed by colour alone. Every badge carries a colour, a
 * distinct icon shape, and the word. That covers colour-blind users, the washed-out
 * screens these phones often have, and daylight outdoors — and it keeps meaning in
 * the text layer for the speak button.
 *
 * The `info` shape is deliberately unlike the others: a circled "i", never a
 * triangle or a cross, so an I02 safekeeping note cannot read as a problem (§10.3).
 */

const STYLES: Record<Severity, { text: string; bg: string; border: string }> = {
  critical: { text: 'text-critical', bg: 'bg-critical-soft', border: 'border-critical' },
  high: { text: 'text-high', bg: 'bg-high-soft', border: 'border-high' },
  medium: { text: 'text-medium', bg: 'bg-medium-soft', border: 'border-medium' },
  info: { text: 'text-info', bg: 'bg-info-soft', border: 'border-info' },
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function SeverityIcon({ severity, size = 18 }: { severity: Severity; size?: number }) {
  const props = { ...iconProps, width: size, height: size };

  switch (severity) {
    case 'critical':
      // Octagon + cross: the most distinct outline at a glance.
      return (
        <svg {...props}>
          <path d="M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6Z" />
          <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
        </svg>
      );
    case 'high':
      return (
        <svg {...props}>
          <path d="M12 3.5 21.5 20H2.5Z" />
          <path d="M12 10v4.5M12 17.5v.01" />
        </svg>
      );
    case 'medium':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V13M12 16.2v.01" />
        </svg>
      );
    case 'info':
      // No alarm shape. A calm circled "i".
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.8v.01" />
        </svg>
      );
  }
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = STYLES[severity];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[14px] font-semibold ${style.text} ${style.bg} ${style.border}`}
    >
      <SeverityIcon severity={severity} size={16} />
      {t(`severity.${severity}`)}
    </span>
  );
}

export const severityStyles = STYLES;

/**
 * Verdict banner palette. `safe` gets its own green — mapping it onto the `info`
 * blue would make a clean contract look like a notice rather than a result.
 */
export const VERDICT_STYLES: Record<
  OverallRisk,
  { text: string; bg: string; border: string; icon: Severity }
> = {
  critical: { ...STYLES.critical, icon: 'critical' },
  high: { ...STYLES.high, icon: 'high' },
  caution: { ...STYLES.medium, icon: 'medium' },
  safe: { text: 'text-safe', bg: 'bg-safe-soft', border: 'border-safe', icon: 'info' },
};

/** A tick, used only for the safe verdict. */
export function SafeIcon({ size = 28 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
    </svg>
  );
}
