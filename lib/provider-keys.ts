import 'server-only';
import type { Assistant, ProviderKeyInfo } from './api-types';
import { HttpError } from './http';
import { db, must } from './supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Key metadata for Settings. The key itself never leaves the database except to process-run. */
export async function listProviderKeys(): Promise<ProviderKeyInfo[]> {
  const sb = db();
  const [assistants, info] = await Promise.all([
    sb.from('assistants').select('id,label,key_present').order('id'),
    sb.rpc('provider_key_info'),
  ]);
  const rows = must(assistants, 'assistants') as any[];
  const byAssistant = new Map<string, any>((must(info, 'provider_key_info') as any[]).map((r) => [r.assistant, r]));
  return rows.map((a) => {
    const k = byAssistant.get(a.id);
    return {
      assistant: a.id as Assistant,
      label: a.label,
      source: k ? 'ui' : a.key_present ? 'env' : null,
      last4: k?.last4 ?? null,
      keyPresent: !!k || !!a.key_present,
      updatedAt: k?.updated_at ?? null,
      updatedByEmail: k?.updated_by_email ?? null,
    };
  });
}

/**
 * Check a key against the provider's free list-models endpoint (5 s).
 * 401/403 -> 400 key_invalid (not saved). Network trouble -> verified=false (saved anyway).
 */
export async function verifyProviderKey(assistant: Assistant, key: string): Promise<boolean> {
  const req: Record<Assistant, { url: string; headers: Record<string, string> }> = {
    openai: { url: 'https://api.openai.com/v1/models', headers: { authorization: `Bearer ${key}` } },
    anthropic: { url: 'https://api.anthropic.com/v1/models?limit=1', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', headers: { 'x-goog-api-key': key } },
  };
  const { url, headers } = req[assistant];
  let status: number;
  try {
    const res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(5000), cache: 'no-store' });
    status = res.status;
    await res.body?.cancel();
  } catch {
    return false;
  }
  if (status === 400 || status === 401 || status === 403) {
    throw new HttpError(400, 'key_invalid', `The ${assistant} API rejected this key (HTTP ${status})`, 'apiKey');
  }
  return status >= 200 && status < 300;
}
