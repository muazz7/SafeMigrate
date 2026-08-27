import Link from 'next/link';
import { Disclaimer } from '@/components/Disclaimer';
import { t } from '@/lib/strings';

/** Home — BUILD-SPEC §10.1. Four features, one trust line, no marketing copy. */

const FEATURES = [
  { href: '/scan', titleKey: 'home.scan_title', descKey: 'home.scan_desc' },
  { href: '/agency', titleKey: 'home.agency_title', descKey: 'home.agency_desc' },
  { href: '/cost', titleKey: 'home.cost_title', descKey: 'home.cost_desc' },
  { href: '/vault', titleKey: 'home.vault_title', descKey: 'home.vault_desc' },
] as const;

export default function HomePage() {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-[26px] font-semibold">{t('app.name')}</h1>
        <p className="text-muted mt-1">{t('app.tagline')}</p>
      </section>

      <ul className="flex flex-col gap-3">
        {FEATURES.map((feature) => (
          <li key={feature.href}>
            <Link
              href={feature.href}
              className="card focus-ring block p-4 active:bg-brand-soft"
            >
              <span className="block font-semibold text-brand">{t(feature.titleKey)}</span>
              <span className="block text-muted text-[15px] mt-0.5">{t(feature.descKey)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="bg-brand-soft text-ink rounded-[12px] px-4 py-3 text-[15px]">
        {t('home.trust')}
      </p>

      <Disclaimer />
    </div>
  );
}
