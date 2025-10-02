// src/components/mobile/MobileNavItem.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

interface MobileNavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export default function MobileNavItem({ href, icon, label, onClick }: MobileNavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + '/');
  const textColor = isActive ? '#fff' : '#425466';
  const iconColor = isActive ? '#fff' : '#425466';

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        padding: '6px 20px',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '20px',
        borderRadius: '10px',
        textDecoration: 'none',
        width: '100%',
        minHeight: '36px',
        transition: 'background-color 120ms ease-in-out',
        ...(isActive ? { background: '#0177FB' } : {}),
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '#E6F0FF';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '';
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1
        }}
      >
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { stroke: iconColor })
          : icon}
      </div>
      <span
        style={{
          color: textColor,
          fontFamily: 'Gilroy',
          fontSize: '16px',
          fontStyle: 'normal',
          fontWeight: 300,
          lineHeight: 'normal',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
    </Link>
  );
}