// src/components/ResponsiveLayout.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMobileMenu } from "@/hooks/useMobileMenu";
import Sidebar from "@/app/(app shell)/sidebar/Sidebar";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileDrawer from "@/components/mobile/MobileDrawer";
import Box from "@/components/ui/Box";

interface ResponsiveLayoutProps {
  children: React.ReactNode;
}

export default function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const { isOpen, toggle, close } = useMobileMenu();
  const [isDesktop, setIsDesktop] = useState(true);
  const pathname = usePathname();

  // Determine the title based on the current route
  const getMobileTitle = () => {
    if (pathname?.startsWith('/schedule')) return 'Schedule';
    if (pathname?.startsWith('/tests')) return 'Tests';
    if (pathname?.startsWith('/flag-status')) return 'Flag Status';
    if (pathname?.startsWith('/events')) return 'Events';
    if (pathname?.startsWith('/membership')) return 'Membership';
    if (pathname?.startsWith('/feedback')) return 'Feedback';
    return 'SABC';
  };

  useEffect(() => {
    // Check if screen is desktop (>= 768px)
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    // Initial check
    checkDesktop();

    // Listen for resize
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return (
    <>
      {/* Mobile Header - visible only on mobile (< 768px) */}
      {!isDesktop && <MobileHeader onMenuClick={toggle} isOpen={isOpen} title={getMobileTitle()} />}

      {/* Mobile Drawer - visible only on mobile when open */}
      {!isDesktop && <MobileDrawer isOpen={isOpen} onClose={close} />}

      {/* Main Layout Container */}
      <div className="flex min-h-screen">
        {/* Desktop Sidebar - visible only on desktop (≥ 768px) */}
        {isDesktop && <Sidebar />}

        {/* Main Content Area */}
        <Box
          as="main"
          className="flex-1 min-h-screen max-h-screen overflow-hidden bg-surface"
          style={{
            paddingTop: isDesktop ? 0 : 'var(--mobile-header-height)',
            padding: isDesktop ? '32px' : '16px',
          }}
        >
          {children}
        </Box>
      </div>
    </>
  );
}
