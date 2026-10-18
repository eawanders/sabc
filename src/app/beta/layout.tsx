// /beta: the new crew experience, side by side with the current app (PER-277). Not in the nav, not indexed.
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { IdentityProvider } from './_components/Identity';
import { ToastProvider } from './_components/Toasts';
import { BetaShell } from './_components/BetaNav';
import { noGoFlagLabel } from './_lib/flag-alert';
import './beta.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Beta',
  robots: { index: false, follow: false },
};

export default async function BetaLayout({ children }: { children: React.ReactNode }) {
  const noGoFlag = await noGoFlagLabel();
  return (
    <div className={`beta ${inter.variable}`}>
      <ToastProvider>
        <IdentityProvider>
          <BetaShell noGoFlag={noGoFlag}>{children}</BetaShell>
        </IdentityProvider>
      </ToastProvider>
    </div>
  );
}
