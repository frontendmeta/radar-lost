// Types shared by every module inside supabase/functions (Deno). DB rows stay snake_case.
export type Assistant = 'openai' | 'anthropic' | 'gemini';
export type SourceType = 'brand_site' | 'marketplace' | 'listicle' | 'review' | 'other';
export type LossReason = 'over_budget' | 'delivery_unclear_or_slow' | 'size_or_stock' | 'missing_details' | 'weaker_reviews' | 'better_fit_elsewhere' | 'not_found';
export type Tri = 'yes' | 'no' | 'unknown';
export const LOSS_REASONS: LossReason[] = ['over_budget', 'delivery_unclear_or_slow', 'size_or_stock', 'missing_details', 'weaker_reviews', 'better_fit_elsewhere', 'not_found'];

export interface ShopperLocation { city: string; region: string; country: string; timezone: string; lat: number; lng: number }

/** Normalized output of every shopper adapter (providers/*.ts). */
export interface ShopperResult {
  answerText: string;
  webSearched: boolean;            // false if the model answered without searching
  searches: string[];              // queries the model ran
  sources: { url: string; title: string; cited: boolean }[];
  raw: unknown;                    // full provider response, stored as-is
  usage: unknown;
  latencyMs: number;
}
export type ShopperAdapter = (args: { prompt: string; model: string; location: ShopperLocation; apiKey: string }) => Promise<ShopperResult>;

export interface BrandRow { id: string; name: string; aliases: string[]; domains: string[]; is_primary: boolean }
export interface MarketplaceRow { id: string; name: string; domains: string[] }
export interface QueryRow { id: string; code: string; text: string; product_id: string; budget_inr: number; city: string; deadline_days: number }

/** A source after match.ts typed it; the shape save_answer() inserts. */
export interface TypedSource {
  ord: number; url: string; title: string; domain: string; root_domain: string;
  source_type: SourceType; brand_id: string | null; marketplace_id: string | null; cited: boolean;
}

/** The shape save_decision() inserts into decisions (column names). */
export interface DecisionRow {
  mentioned_brand_ids: string[]; shortlist_brand_ids: string[];
  pick_brand_id: string | null; pick_brand_name: string | null; pick_product: string | null;
  pick_price_inr: number | null; pick_channel: string | null; pick_url: string | null; pick_delivery_days: number | null;
  fits_budget: Tri; fits_deadline: Tri; reasoning_excerpt: string | null; extractor_model: string; raw: unknown;
}
export interface RejectionRow { brand_id: string; reason: LossReason; note: string | null }

/** Which model the extractor / fixes call uses. */
export interface ModelCfg { provider: Assistant; model: string; apiKey: string }
