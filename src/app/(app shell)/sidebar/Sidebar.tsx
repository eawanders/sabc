// src/app/(app shell)/sidebar/Sidebar.tsx
"use client";

import NavItem from "./NavItem";
import SwimIcon from "./SwimIcon";
import PersonIcon from "./PersonIcon";
import { MoreSquareIcon } from "./MoreSquareIcon";
import { SendIcon } from "./SendIcon";
import { HomeIcon } from "./HomeIcon";
import { CoxingIcon } from "./CoxingIcon";
import { EventsIcon } from "./EventsIcon";
import { usePathname, useRouter } from "next/navigation";
import Box from "@/components/ui/Box";
import ActionButton from "@/components/ui/ActionButton";
import Image from "next/image";

/** Clock icon for schedule navigation */
function ClockIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#425466";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.71 15.18L12.61 13.33C12.07 13.01 11.63 12.24 11.63 11.61V7.51001" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Flag icon for flag status navigation */
function FlagIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#425466";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
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
  style={{ gap: 40, borderRight: '1px solid #DFE5F1', backgroundColor: '#ffffff' }}
    >
      {/* Brand */}
      <Box>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          alignSelf: 'stretch'
        }}>
          <Image
            src="/sabc-logo.png"
            alt="SABC Logo"
            width={40}
            height={40}
          />
          <div style={{
            color: '#27272e',
            fontFamily: 'Gilroy',
            fontSize: '32px',
            fontStyle: 'normal',
            fontWeight: 800,
            lineHeight: 'normal'
          }}>
            SABC
          </div>
        </div>
      </Box>


      {/* Nav */}
      <Box
        as="nav"
        className="flex flex-col"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flex: '1 0 0',
          marginTop: 0,
          paddingTop: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%',
            alignItems: 'flex-start',
            marginTop: 0,
            paddingTop: 0
          }}
        >
          <NavItem
            href="/home"
            label="Home"
            icon={<HomeIcon stroke={pathname?.startsWith("/home") ? "#fff" : "#425466"} />}
            active={pathname?.startsWith("/home")}
          />
          <NavItem
            href="/schedule"
            label="Schedule"
            icon={<ClockIcon stroke="#425466" />}
            active={!!isSchedule}
          />
          <NavItem
            href="/coxing"
            label="Coxing"
            icon={<CoxingIcon stroke={pathname?.startsWith("/coxing") ? "#fff" : "#425466"} />}
            active={pathname?.startsWith("/coxing")}
          />
          <NavItem
            href="/flag-status"
            label="Flag Status"
            icon={<FlagIcon stroke="#425466" />}
            active={!!isFlagStatus}
          />
          <NavItem
            href="/tests"
            label="OURC Tests"
            icon={<SwimIcon stroke="#425466" />}
            active={pathname?.startsWith("/tests")}
          />
          <NavItem
            href="/events"
            label="Events"
            icon={<EventsIcon stroke={pathname?.startsWith("/events") ? "#fff" : "#425466"} />}
            active={pathname?.startsWith("/events")}
          />
          <div style={{ width: '100%', height: '1px', background: '#DFE5F1', margin: '8px 0' }} />
          <NavItem
            href="/membership"
            label="Members"
            icon={<PersonIcon stroke="#425466" />}
            active={pathname?.startsWith("/membership")}
          />
          <NavItem
            href="/feedback"
            label="Feedback"
            icon={<SendIcon width={20} height={20} stroke={pathname?.startsWith("/feedback") ? "#fff" : "#425466"} />}
            active={pathname?.startsWith("/feedback")}
          />
        </div>
      </Box>
    </Box>
  );
}