// Lost Sale Radar — API contract shared with the UI.
// A change here is announced to Prathm before it ships.
// Conventions: camelCase JSON; rates are 0–1 floats; money is whole rupees;
// dates are ISO strings; unknown is null, never 0. Plain JSON only.

export type Assistant = 'openai' | 'anthropic' | 'gemini';
export type LossReason = 'over_budget' | 'delivery_unclear_or_slow' | 'size_or_stock' | 'missing_details' | 'weaker_reviews' | 'better_fit_elsewhere' | 'not_found';
export type SourceType = 'brand_site' | 'marketplace' | 'listicle' | 'review' | 'other';
export type BrandOutcome = 'picked' | 'mentioned_lost' | 'found_not_mentioned' | 'not_found';
export type Tri = 'yes' | 'no' | 'unknown';
export type RunState = 'queued' | 'processing' | 'done' | 'partial' | 'failed' | 'cancelled';

export interface ApiError { error: { code: string; message: string; field?: string } }

export interface Me { email: string; name: string | null; avatarUrl: string | null }
export interface Brand { id: string; name: string; aliases: string[]; domains: string[]; isPrimary: boolean }
export interface Marketplace { id: string; name: string; domains: string[] }
export interface Product { id: string; code: string; name: string; url: string; priceInr: number; mrpInr: number | null; sizes: string[]; fabric: string; style: string; deliveryDays: number | null; deliveryIsSample: boolean }
export interface Query { id: string; code: string; text: string; productId: string; budgetInr: number; city: string; deadlineDays: number }
export interface AssistantInfo { id: Assistant; label: string; enabled: boolean; model: string | null; effectiveModel: string; keyPresent: boolean }
export interface RunDefaults { attempts: number; city: string; region: string; country: string; timezone: string; lat: number; lng: number; extractorModel: string | null; fixesModel: string | null }
export interface Setup { brand: Brand; products: Product[]; competitors: Brand[]; marketplaces: Marketplace[]; queries: Query[]; assistants: AssistantInfo[] }
export interface SettingsBundle extends Setup { runDefaults: RunDefaults; updatedAt: string | null; updatedByEmail: string | null }

export interface RunListItem {
  id: string; label: string | null; trigger: 'manual' | 'live'; status: RunState; createdAt: string; createdByEmail: string | null;
  assistants: Assistant[]; city: string; total: number; done: number; failed: number; costUsd: number | null;
}
export interface RunStatus extends RunListItem {
  fixesStatus: 'pending' | 'running' | 'done' | 'failed'; inFlight: number;
  byAssistant: { assistant: Assistant; total: number; done: number; failed: number }[];
}

export interface Rate { n: number; of: number; rate: number | null }
export interface LensEcho { runId: string; focusBrandId: string; assistants: Assistant[]; productIds: string[]; queryIds: string[] }
export interface Summary {
  lens: LensEcho; focus: { id: string; name: string; isPrimary: boolean };
  done: number; failed: number; found: Rate; mentioned: Rate; picked: Rate; gap: number | null; budgetMisses: Rate;
  compare: { runId: string; label: string | null; sharedPairs: number; foundDelta: number | null; mentionedDelta: number | null; pickedDelta: number | null } | null;
}
export interface ByAssistant { assistant: Assistant; done: number; found: Rate; mentioned: Rate; picked: Rate }
export interface Win { brandId: string | null; brandName: string; isPrimary: boolean; isFocus: boolean; picks: number; share: number }
export interface LossReasonRow { reason: LossReason | 'found_not_mentioned'; n: number; share: number }
export interface SourcesBreakdown {
  byType: { type: SourceType; n: number }[];
  topDomains: { domain: string; type: SourceType; n: number; focusPresent: boolean }[];
  focusPickChannels: { channel: string; n: number }[];
}
export interface QueryRow {
  queryId: string; code: string; text: string; productId: string;
  perAssistant: { assistant: Assistant; attempts: number; found: number; mentioned: number; picked: number; topWinner: string | null }[];
  picked: Rate;
}
export interface LostSale {
  taskId: string; queryCode: string; queryText: string; assistant: Assistant; outcome: Exclude<BrandOutcome, 'picked'>;
  winner: string | null; winnerPriceInr: number | null; reason: LossReason | null;
  ourProduct: { name: string; priceInr: number; deliveryDays: number | null; deliveryIsSample: boolean } | null;
}
export interface Trace {
  taskId: string; runId: string; assistant: Assistant; model: string; attempt: number; webSearched: boolean;
  query: Query; ourProduct: Product | null; promptText: string;
  searches: string[];
  sources: { url: string; title: string; domain: string; type: SourceType; brand: string | null; cited: boolean }[];
  answerText: string; mentioned: string[]; shortlist: string[];
  pick: { brand: string; product: string | null; priceInr: number | null; channel: string; url: string | null; deliveryDays: number | null } | null;
  fitsBudget: Tri; fitsDeadline: Tri;
  outcomes: { brandId: string; brandName: string; outcome: BrandOutcome; reason: LossReason | null; note: string | null }[];
  reasoningExcerpt: string | null;
}
export interface Fix { ord: 1 | 2 | 3; title: string; why: string; action: string; fixType: 'listing' | 'content' | 'marketplace' | 'pr' | 'site' | 'pricing'; evidenceTaskIds: string[] }
export interface LensOptions { runs: RunListItem[]; brands: Brand[]; assistants: AssistantInfo[]; products: Product[]; queries: Query[] }
export interface Health { processorReachable: boolean; lastKickAt: string | null; lastKickStatus: string | null; leaseUntil: string | null; queuedTasks: number; oldestQueuedAgeSec: number | null; openBreakers: Assistant[]; keysPresent: Record<Assistant, boolean> }

// Provider API keys (entered in Settings, stored encrypted in Supabase Vault; never returned).
// source: 'ui' = saved in Settings (wins), 'env' = server env fallback, null = none.
export interface ProviderKeyInfo { assistant: Assistant; label: string; source: 'ui' | 'env' | null; last4: string | null; keyPresent: boolean; updatedAt: string | null; updatedByEmail: string | null }
export interface SaveKeyResult extends ProviderKeyInfo { verified: boolean }

// GET /api/runs/:id/tasks — every task of a run (≤ 300), for run progress, failures and the live test.
export type TaskState = 'pending' | 'answering' | 'answered' | 'extracting' | 'done' | 'failed' | 'cancelled';
export interface RunTask {
  id: string; queryId: string; queryCode: string; queryText: string; assistant: Assistant; model: string; attempt: number;
  status: TaskState; failureClass: 'retryable' | 'model' | 'config' | 'unknown' | null; error: string | null;
  callStartedAt: string | null; doneAt: string | null;
  pickBrand: string | null;                  // the AI's pick (any brand name), null until done
  focusOutcome: BrandOutcome | null;         // the primary brand's outcome in this task, null until done
  focusReason: LossReason | null;
}
