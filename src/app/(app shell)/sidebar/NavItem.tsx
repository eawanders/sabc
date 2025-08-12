import Link from "next/link";
import { cn } from "@/lib/classnames";

type NavItemProps = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  className?: string;
};

export default function NavItem({
  href,
  label,
  icon,
  active = false,
  className,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
  // Make the item respect the fixed sidebar width and allow text to truncate
  "group flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast ease-brand",
        active
          ? "bg-accent/60 text-heading"
          : "text-muted hover:text-heading hover:bg-accent/40",
        className
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="shrink-0 text-heading">{icon}</span>
      <span className="truncate flex-1 min-w-0">
        {label}
      </span>
    </Link>
  );
}