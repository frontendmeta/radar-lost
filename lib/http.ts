import { NextResponse, connection } from 'next/server';
import type { ApiError } from './api-types';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, field?: string) => new HttpError(400, code, message, field);
export const notFound = (code: string, message: string) => new HttpError(404, code, message);

export function json<T>(body: T, status = 200) {
  return NextResponse.json(body, { status });
}

export function errorJson(status: number, code: string, message: string, field?: string) {
  const body: ApiError = { error: { code, message, ...(field ? { field } : {}) } };
  return NextResponse.json(body, { status });
}

/**
 * Wrap a route handler: HttpError -> JSON error with its status; anything else -> 500.
 * Usage: export const GET = route(async (req, ctx) => { ... return json(x) });
 */
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    // Outside the try: during prerender connection() rejects on purpose so Next marks the
    // route dynamic. Catching it here would bake a static 500 into the build.
    await connection();
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return errorJson(e.status, e.code, e.message, e.field);
      console.error('[api] unhandled', e instanceof Error ? e.message : e);
      return errorJson(500, 'internal', 'Internal error');
    }
  };
}

/** Parse a JSON body; 400 bad_json when malformed. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw badRequest('bad_json', 'Request body is not valid JSON');
  }
}
