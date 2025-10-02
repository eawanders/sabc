import type { Metadata, Viewport } from "next";
import { gilroy } from "@/config/fonts";
import "@/app/globals.css";
import Sidebar from "@/app/(app shell)/sidebar/Sidebar";
import Box from "@/components/ui/Box";
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: {
    default: 'SABC',
    template: 'SABC - %s',
  },
  description: "The home of St Antony's College, Oxford's Boat Club!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={gilroy.variable}>
      <head>
        {/* Primary favicon (PNG) */}
        <link rel="icon" type="image/png" sizes="32x32" href="/sabc-logo.png" />
        {/* Fallback for browsers that request /favicon.ico */}
        <link rel="icon" href="/favicon.ico" />
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/sabc-logo.png" />
        {/* SVG (modern browsers) */}
        <link rel="icon" type="image/svg+xml" href="/sabc-logo.svg" />
      </head>
      <body className="min-h-screen bg-bg text-foreground antialiased overflow-x-hidden">
        <div className="flex min-h-screen">
          <Sidebar />
          <Box as="main" className="flex-1 min-h-screen max-h-screen overflow-hidden bg-surface" p={32}>
            {children}
          </Box>
        </div>
        <Analytics />
      </body>
    </html>
  );
}