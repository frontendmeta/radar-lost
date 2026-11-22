import 'server-only';

/**
 * POST the processor and await its 202 (3 s timeout). On Vercel, a request not awaited
 * before the response is sent can be cut off, so callers always await this.
 */
export async function kickProcessor(): Promise<{ ok: boolean; status: number | null; error?: string }> {
  const url = process.env.PROCESSOR_URL;
  const secret = process.env.PROCESSOR_SECRET;
  if (!url || !secret) return { ok: false, status: null, error: 'PROCESSOR_URL or PROCESSOR_SECRET not set' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-processor-secret': secret },
      body: '{}',
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    return { ok: res.status === 202 || res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : String(e) };
  }
}
