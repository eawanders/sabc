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
  const textColor = active ? 'var(--Blue, #0177FB)' : '#7D8DA6';
  const iconColor = active ? '#0177FB' : '#7D8DA6';

  return (
    <Link
      href={href}
      className={cn(
        "group w-full min-w-0 text-sm transition-colors duration-fast ease-brand bg-white hover:bg-[#E1E8FF]",
        className
      )}
      style={{
        display: 'flex',
        padding: '8px 30px',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '10px',
        borderRadius: '10px',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.15)',
        textDecoration: 'none',
        maxWidth: '100%'
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