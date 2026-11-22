import { MessageSquareText, Radar, Rocket, SlidersHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export interface DockItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const DEFAULT_DOCK_ITEMS: DockItem[] = [
  { key: "radar", label: "Radar", href: "/", icon: Radar },
  { key: "queries", label: "Queries", href: "/queries", icon: MessageSquareText },
  { key: "runs", label: "Runs", href: "/runs", icon: Rocket },
  { key: "settings", label: "Settings", href: "/settings", icon: SlidersHorizontal },
];

export interface DockProps {
  /** Key of the active item ("radar" | "queries" | "runs" | "settings" by default). */
  active: string;
  items?: DockItem[];
  /** Pin to the bottom centre of the viewport. */
  floating?: boolean;
  className?: string;
}

/** Pencil: Dock (p3ux2z). 64 px raised pill nav; active item brand-500. */
export function Dock({ active, items = DEFAULT_DOCK_ITEMS, floating = false, className }: DockProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-16 w-fit items-center gap-1 rounded-pill bg-surface p-2 shadow-raised",
        floating && "fixed bottom-6 left-1/2 z-40 -translate-x-1/2",
        className,
      )}
    >
      {items.map(({ key, label, href, icon: Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-2 rounded-pill px-5 text-[15px] leading-6 font-semibold whitespace-nowrap transition-colors duration-150",
              isActive ? "bg-brand-500 text-on-brand" : "text-ink-700 hover:bg-ink-100",
            )}
          >
            <Icon aria-hidden size={20} strokeWidth={ICON_STROKE} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
