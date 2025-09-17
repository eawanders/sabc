import Link from "next/link";
import React from "react";
import { cn } from "@/lib/classnames";
import { SpacingProps, getSpacingStyles } from "@/lib/spacing";

interface NavItemProps extends SpacingProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  className?: string;
}

export default function NavItem({
  href,
  label,
  icon,
  active = false,
  className,
  ...spacingProps
}: NavItemProps) {
  const textColor = active ? '#fff' : '#425466';
  const iconColor = active ? '#fff' : '#425466';

  return (
    <Link
      href={href}
      className={cn(
        "group w-full min-w-0 text-sm transition-colors duration-fast ease-brand",
  !active && "hover:bg-[#E6F0FF]",
        className
      )}
      style={{
        display: 'flex',
        padding: '6px 20px',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '20px',
        borderRadius: '10px',
        boxShadow: 'none',
        textDecoration: 'none',
        maxWidth: '100%',
        minHeight: '36px',
        ...(active ? { background: '#0177FB' } : {}),
      }}
      aria-current={active ? "page" : undefined}
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
        className="truncate flex-1 min-w-0"
        style={{
          color: textColor,
          fontFamily: 'Gilroy',
          fontSize: '16px',
          fontStyle: 'normal',
          fontWeight: 300,
          lineHeight: 'normal'
        }}
      >
        {label}
      </span>
    </Link>
  );
}