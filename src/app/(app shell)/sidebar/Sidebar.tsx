// src/app/(app shell)/sidebar/Sidebar.tsx
"use client";

import NavItem from "./NavItem";
import { usePathname, useRouter } from "next/navigation";
import Box from "@/components/ui/Box";
import ActionButton from "@/components/ui/ActionButton";

/** Clock icon for schedule navigation */
function ClockIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#0177FB";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.71 15.18L12.61 13.33C12.07 13.01 11.63 12.24 11.63 11.61V7.51001" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Flag icon for flag status navigation */
function FlagIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#0177FB";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 21L8 16M8 16L17.7231 9.51793C18.0866 9.2756 18.0775 8.73848 17.7061 8.50854L8.91581 3.06693C8.5161 2.81949 8 3.10699 8 3.57709V16Z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 11.0001L14.5 6.52393" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isSchedule = pathname?.startsWith("/schedule");
  const isFlagStatus = pathname?.startsWith("/flag-status");

  return (
    <Box
      as="aside"
      aria-label="Primary"
      className="
        sticky top-0 h-screen flex-none
        w-[var(--sidebar-width)]
        flex flex-col
        bg-surface text-foreground
        shadow
      "
      p={32}
      style={{ gap: '16px', borderRight: '1px solid #DFE5F1' }}
    >
      {/* Brand */}
      <Box>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          alignSelf: 'stretch'
        }}>
          <img
            src="/sabc-logo.png"
            alt="SABC Logo"
            style={{
              width: '50px',
              height: '50px'
            }}
          />
          <div style={{
            color: '#000',
            fontFamily: 'Gilroy',
            fontSize: '17px',
            fontStyle: 'normal',
            fontWeight: 800,
            lineHeight: 'normal'
          }}>
            St Antony&apos;s Boat Club
          </div>
        </div>
      </Box>

      {/* Divider */}
      <div style={{
        width: '100%',
        height: '1px',
        backgroundColor: '#DFE5F1'
      }} />

      {/* Nav */}
      <Box
        as="nav"
        className="flex flex-col"
        py={8}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flex: '1 0 0'
        }}
      >
        <div style={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '16px'
        }}>
          <NavItem
            href="/schedule"
            label="Schedule"
            icon={<ClockIcon />}
            active={!!isSchedule}
          />
          <NavItem
            href="/flag-status"
            label="ISIS Flags"
            icon={<FlagIcon />}
            active={!!isFlagStatus}
          />
        </div>

        <ActionButton onClick={() => router.push('/feedback')}>
          Feedback
        </ActionButton>
      </Box>
    </Box>
  );
}