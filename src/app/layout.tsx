import type { Metadata, Viewport } from "next";
import { gilroy } from "@/config/fonts";
import "@/app/globals.css";
import Sidebar from "@/app/(app shell)/sidebar/Sidebar";
import Box from "@/components/ui/Box";

export const metadata: Metadata = {
  title: "SABC — Outings",
  description: "Sign up and confirm availability for water outings, erg, gym, and tank sessions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={gilroy.variable}>
      <body className="min-h-screen bg-bg text-foreground antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <Box as="main" className="flex-1 min-h-screen max-h-screen overflow-y-auto bg-surface" p={24}>
            {children}
          </Box>
        </div>
      </body>
    </html>
  );
}