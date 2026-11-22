import type { Assistant, Fix, LossReason, SourceType } from "@/lib/api-types";

export type { Assistant };

export type Outcome =
  | "picked"
  | "mentioned_lost"
  | "found_not_mentioned"
  | "not_found"
  | "failed";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  picked: "Picked",
  mentioned_lost: "Named, lost",
  found_not_mentioned: "Seen, never named",
  not_found: "Never found",
  failed: "Failed",
};

export const ASSISTANT_LABEL: Record<Assistant, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
};

/** CSS colour for an assistant (badges and per-assistant lines only). */
export const ASSISTANT_COLOR: Record<Assistant, string> = {
  openai: "var(--color-chatgpt)",
  anthropic: "var(--color-claude)",
  gemini: "var(--color-gemini)",
};

export type ReasonKey = LossReason | "found_not_mentioned";

export const LOSS_REASON_LABEL: Record<ReasonKey, string> = {
  over_budget: "Over budget",
  delivery_unclear_or_slow: "Delivery unclear or slow",
  size_or_stock: "Size or stock",
  missing_details: "Missing details",
  weaker_reviews: "Weaker reviews",
  better_fit_elsewhere: "Better fit elsewhere",
  not_found: "Never found",
  found_not_mentioned: "Seen, never named",
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  brand_site: "Brand site",
  marketplace: "Marketplace",
  listicle: "Listicle",
  review: "Review",
  other: "Other",
};

export type FixType = Fix["fixType"];

export const FIX_TYPE_LABEL: Record<FixType, string> = {
  listing: "Listing",
  content: "Content",
  marketplace: "Marketplace",
  pr: "PR",
  site: "Site",
  pricing: "Pricing",
};

const COMPETITOR_COLORS = [
  "var(--color-comp-teal)",
  "var(--color-comp-indigo)",
  "var(--color-comp-marigold)",
  "var(--color-comp-olive)",
  "var(--color-comp-sky)",
  "var(--color-comp-plum)",
  "var(--color-comp-clay)",
];

/** Competitor colour by rank of wins (0-based). Past the palette, or unknown → comp-other. */
export function competitorColor(index: number | null | undefined): string {
  if (index == null || index < 0 || index >= COMPETITOR_COLORS.length) {
    return "var(--color-comp-other)";
  }
  return COMPETITOR_COLORS[index];
}

/** Lucide stroke from the design: stroke 1.75, round caps. */
export const ICON_STROKE = 1.75;
