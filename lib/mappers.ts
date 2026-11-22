import 'server-only';
import type { Assistant, AssistantInfo, Brand, Marketplace, Product, Query, RunDefaults } from './api-types';
import { envModel } from './models';

/* eslint-disable @typescript-eslint/no-explicit-any */
// DB row (snake_case) -> API type (camelCase). Shared by every route.

export const toBrand = (r: any): Brand => ({ id: r.id, name: r.name, aliases: r.aliases ?? [], domains: r.domains ?? [], isPrimary: !!r.is_primary });
export const toMarketplace = (r: any): Marketplace => ({ id: r.id, name: r.name, domains: r.domains ?? [] });
export const toProduct = (r: any): Product => ({
  id: r.id, code: r.code, name: r.name, url: r.url, priceInr: r.price_inr, mrpInr: r.mrp_inr ?? null, sizes: r.sizes ?? [],
  fabric: r.fabric ?? '', style: r.style ?? '', deliveryDays: r.delivery_days ?? null, deliveryIsSample: !!r.delivery_is_sample,
});
export const toQuery = (r: any): Query => ({
  id: r.id, code: r.code, text: r.text, productId: r.product_id, budgetInr: r.budget_inr, city: r.city, deadlineDays: r.deadline_days,
});
export const toAssistant = (r: any): AssistantInfo => ({
  id: r.id as Assistant, label: r.label, enabled: !!r.enabled, model: r.model ?? null,
  effectiveModel: r.model || envModel(r.id as Assistant), keyPresent: !!r.key_present,
});
export const toRunDefaults = (r: any): RunDefaults => ({
  attempts: r.default_attempts, city: r.city, region: r.region, country: r.country, timezone: r.timezone,
  lat: Number(r.lat), lng: Number(r.lng), extractorModel: r.extractor_model ?? null, fixesModel: r.fixes_model ?? null,
});
