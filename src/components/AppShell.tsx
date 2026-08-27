'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { platform } from '@/lib/platform';
import { t } from '@/lib/strings';

/**
 * App frame: brand header, routed content, and the always-visible bottom nav.
 * Handles native chrome (status bar, splash, hardware back) exactly once — no
 * other component may touch platform chrome (BUILD-SPEC §9.2).
 */

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const NAV: NavItem[] = [
  {
    href: '/scan',
    labelKey: 'nav.scan',
    icon: (
      <svg {...iconProps}>
        <path d="M3 8V5.5A1.5 1.5 0 0 1 4.5 4H7" />
        <path d="M17 4h2.5A1.5 1.5 0 0 1 21 5.5V8" />
        <path d="M21 16v2.5a1.5 1.5 0 0 1-1.5 1.5H17" />
        <path d="M7 20H4.5A1.5 1.5 0 0 1 3 18.5V16" />
        <path d="M7 12h10" />
      </svg>
    ),
  },
  {
    href: '/agency',
    labelKey: 'nav.agency',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3 4 6.5v5c0 4.5 3.2 8.3 8 9.5 4.8-1.2 8-5 8-9.5v-5Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/cost',
    labelKey: 'nav.cost',
    icon: (
      <svg {...iconProps}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </svg>
    ),
  },
  {
    href: '/vault',
    labelKey: 'nav.vault',
    icon: (
      <svg {...iconProps}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Native chrome once per app launch. No-ops entirely on the web.
  useEffect(() => {
    void platform.initNativeChrome();
  }, []);

  // Hardware back. Returning false lets the default history/exit behaviour run.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void platform.onHardwareBack(() => false).then((fn) => {
      unsubscribe = fn;
    });
    return () => unsubscribe?.();
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="pad-top-safe bg-brand text-white sticky top-0 z-20">
        <div className="mx-auto w-full max-w-[480px] px-4 h-14 flex items-center justify-between">
          <Link href="/" className="focus-ring rounded font-semibold text-[19px] leading-none py-2">
            {t('app.name')}
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[480px] px-4 py-5">{children}</main>

      <nav
        aria-label={t('nav.scan')}
        className="pad-bottom-safe sticky bottom-0 z-20 bg-surface border-t border-border"
      >
        <ul className="mx-auto w-full max-w-[480px] grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`tap focus-ring flex flex-col items-center justify-center gap-0.5 py-2 text-[13px] leading-tight ${
                    active ? 'text-brand font-semibold' : 'text-muted'
                  }`}
                >
                  {item.icon}
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
