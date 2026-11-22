import { LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-on-brand hover:bg-brand-600 active:bg-brand-700 disabled:bg-ink-200 disabled:text-ink-400",
  secondary:
    "bg-surface text-ink-900 border border-ink-200 hover:bg-surface-sunken active:bg-ink-100 disabled:bg-surface disabled:text-ink-400",
  ghost:
    "bg-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:bg-transparent disabled:text-ink-400",
  danger:
    "bg-transparent text-lost-700 hover:bg-lost-50 active:bg-lost-50 disabled:bg-transparent disabled:text-ink-400",
};

const SIZE: Record<ButtonSize, { box: string; text: string; icon: number }> = {
  sm: { box: "h-9 px-4 gap-2", text: "text-[14px] leading-5", icon: 16 },
  md: { box: "h-11 px-[22px] gap-2", text: "text-[15px] leading-6", icon: 18 },
  lg: { box: "h-[52px] px-6 gap-2", text: "text-[15px] leading-6", icon: 18 },
};

interface CommonProps {
  /** primary (brand) · secondary (white + border) · ghost (brand text) · danger (ghost in lost-700). */
  variant?: ButtonVariant;
  /** sm 36 px (banner actions) · md 44 px (default) · lg 52 px. */
  size?: ButtonSize;
  /** Lucide icon component shown before the label. */
  icon?: LucideIcon;
  /** Spinning loader replaces the icon; the button is disabled. */
  loading?: boolean;
  /** Icon-only: children become screen-reader text. */
  iconOnly?: boolean;
  children?: ReactNode;
  className?: string;
}

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { href?: never };

export type LinkButtonProps = CommonProps & {
  /** Renders a Next <Link>. */
  href: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
};

function buttonClasses(variant: ButtonVariant, size: ButtonSize, iconOnly: boolean, className?: string) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-pill font-semibold whitespace-nowrap select-none transition-colors duration-150 disabled:cursor-not-allowed",
    SIZE[size].box,
    SIZE[size].text,
    iconOnly && "aspect-square !px-0",
    VARIANT[variant],
    className,
  );
}

function Inner({ icon: Icon, loading, iconOnly, size, children }: CommonProps & { size: ButtonSize }) {
  const px = SIZE[size].icon;
  return (
    <>
      {loading ? (
        <LoaderCircle aria-hidden size={px} strokeWidth={ICON_STROKE} className="shrink-0 animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden size={px} strokeWidth={ICON_STROKE} className="shrink-0" />
      ) : null}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </>
  );
}

/** Pencil: Button / Primary · Secondary · Ghost (+ hover, pressed, disabled, loading, large 52, ghost danger). */
export function Button(props: ButtonProps | LinkButtonProps) {
  if (typeof props.href === "string") {
    const { variant = "primary", size = "md", iconOnly = false, className, href, target, rel, ...inner } =
      props as LinkButtonProps;
    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        aria-label={inner["aria-label"]}
        className={buttonClasses(variant, size, iconOnly, className)}
      >
        <Inner {...inner} iconOnly={iconOnly} size={size} />
      </Link>
    );
  }

  const {
    variant = "primary",
    size = "md",
    icon,
    loading = false,
    iconOnly = false,
    children,
    className,
    type = "button",
    disabled,
    ...rest
  } = props as ButtonProps;
  return (
    <button
      type={type}
      // Loading keeps its variant colour (design) but can't be clicked.
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, iconOnly, cn(loading && "pointer-events-none", className))}
      {...rest}
      onClick={loading ? undefined : rest.onClick}
    >
      <Inner icon={icon} loading={loading} iconOnly={iconOnly} size={size}>
        {children}
      </Inner>
    </button>
  );
}
