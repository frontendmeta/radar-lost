/**
 * Display formatters. Unknown values (null/undefined/NaN) always render "—", never 0.
 */
export const DASH = "—";

const isNum = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** 0–1 rate → "64%". */
export function formatPercent(rate: number | null | undefined, digits = 0): string {
  if (!isNum(rate)) return DASH;
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Plain count → "1,284" (en-IN grouping). */
export function formatCount(n: number | null | undefined): string {
  if (!isNum(n)) return DASH;
  return n.toLocaleString("en-IN");
}

/** 0–1 delta → "4 pts" magnitude (rounded). */
export function formatPoints(delta: number | null | undefined): string {
  if (!isNum(delta)) return DASH;
  const pts = Math.round(Math.abs(delta) * 100);
  return `${pts} ${pts === 1 ? "pt" : "pts"}`;
}

/** Rupees → "₹1,299". */
export function formatInr(n: number | null | undefined): string {
  if (!isNum(n)) return DASH;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Dollars → "≈ $2.10". */
export function formatUsd(n: number | null | undefined, approx = true): string {
  if (!isNum(n)) return DASH;
  return `${approx ? "≈ " : ""}$${n.toFixed(2)}`;
}

/** "n · share%" used in bar rows, e.g. "12 · 14%". */
export function formatCountShare(
  n: number | null | undefined,
  share: number | null | undefined,
): string {
  if (!isNum(n) && !isNum(share)) return DASH;
  return `${isNum(n) ? formatCount(n) : DASH} · ${formatPercent(share)}`;
}

/** Clamp a 0–1 share for bar widths; unknown → 0 width (the label still shows "—"). */
export function barWidth(share: number | null | undefined): string {
  if (!isNum(share)) return "0%";
  return `${Math.max(0, Math.min(1, share)) * 100}%`;
}
