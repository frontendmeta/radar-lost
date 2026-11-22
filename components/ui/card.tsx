import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** page (radius 28, card shadow, padding 28) · hero (padding 32) · inner (radius 18, flat border, padding 20) · sunken well. */
  variant?: "page" | "hero" | "inner" | "well";
  as?: "div" | "section" | "article";
}

const VARIANT = {
  page: "rounded-card bg-surface elevation-card p-7",
  hero: "rounded-card bg-surface elevation-card p-8",
  inner: "rounded-inner bg-surface elevation-flat p-5",
  well: "rounded-inner bg-surface-sunken p-5",
};

/** Card surfaces from "00 Tokens" elevation + radius. Card gap 24, section gap 40. */
export function Card({ variant = "page", as: Tag = "div", className, ...rest }: CardProps) {
  return <Tag className={cn(VARIANT[variant], className)} {...rest} />;
}
