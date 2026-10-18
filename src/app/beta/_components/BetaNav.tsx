'use client';

// Beta app shell: a quiet Linear-style sidebar on desktop, a top bar with a menu sheet on phones.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SignedInAs } from './Identity';

export const BETA_SECTIONS: { href: string; label: string; group: 'main' | 'club' }[] = [
  { href: '/beta', label: 'Home', group: 'main' },
  { href: '/beta/week', label: 'My week', group: 'main' },
  { href: '/beta/schedule', label: 'Schedule', group: 'main' },
  { href: '/beta/availability', label: 'Availability', group: 'main' },
  { href: '/beta/tests', label: 'Swim tests', group: 'main' },
  { href: '/beta/marshalling', label: 'Marshalling', group: 'main' },
  { href: '/beta/events', label: 'Events', group: 'club' },
  { href: '/beta/flag', label: 'Flag status', group: 'club' },
  { href: '/beta/faqs', label: 'FAQs', group: 'club' },
  { href: '/beta/feedback', label: 'Feedback', group: 'club' },
  { href: '/beta/membership', label: 'Membership', group: 'club' },
];

export function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === '/beta' ? pathname === '/beta' : pathname === href || pathname.startsWith(href + '/');
}

function Links({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const group = (g: 'main' | 'club') =>
    BETA_SECTIONS.filter((s) => s.group === g).map((s) => (
      <Link
        key={s.href}
        href={s.href}
        className={`b-navlink${isActive(pathname, s.href) ? ' on' : ''}`}
        aria-current={isActive(pathname, s.href) ? 'page' : undefined}
        onClick={onNavigate}
      >
        {s.label}
      </Link>
    ));
  return (
    <>
      <nav className="b-navgroup" aria-label="Main">{group('main')}</nav>
      <div className="b-navlabel">Club</div>
      <nav className="b-navgroup" aria-label="Club">{group('club')}</nav>
    </>
  );
}

/** `noGoFlag`: "Red flag" / "Black flag" when no crews may go out (read once, in the layout). */
export function BetaShell({ children, noGoFlag = null }: { children: React.ReactNode; noGoFlag?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="b-shell">
      <aside className="b-side">
        <Link href="/beta" className="b-brand">SABC<span className="b-tag">Beta</span></Link>
        <Links pathname={pathname} />
        <div className="b-side-foot">
          <SignedInAs />
          <Link href="/home" className="b-muted">Back to current app</Link>
        </div>
      </aside>
      <div className="b-mobilebar">
        <Link href="/beta" className="b-brand">SABC<span className="b-tag">Beta</span></Link>
        <button className="b-icon" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
        </button>
      </div>
      {open && (
        <div className="b-sheet" role="dialog" aria-label="Menu">
          <Links pathname={pathname} onNavigate={() => setOpen(false)} />
          <div className="b-side-foot">
            <SignedInAs />
            <Link href="/home" className="b-muted">Back to current app</Link>
          </div>
        </div>
      )}
      <main className="b-main">
        {noGoFlag && pathname !== '/beta/flag' && (
          <Link href="/beta/flag" className="b-flagline" role="alert">
            <span className="in">
              <span className="b-dot no" />
              <span className="tx">
                <b>{noGoFlag}.</b> No crews are allowed out.
              </span>
              <span className="more">Flag status →</span>
            </span>
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
