// Shared error type for every provider / extractor / fixes call inside process-run.
export type FailureClass = 'retryable' | 'model' | 'config' | 'unknown';

export class ProviderError extends Error {
  constructor(
    public failureClass: FailureClass,
    message: string,
    public retryAfterSeconds: number | null = null,
    public status: number | null = null,
  ) {
    super(scrub(message));
  }
}

/** Remove anything shaped like an API key before it is stored or logged. */
export function scrub(s: string): string {
  return String(s ?? '')
    .replace(/sk-[A-Za-z0-9_\-]{10,}/g, 'sk-***')
    .replace(/sk-ant-[A-Za-z0-9_\-]{10,}/g, 'sk-ant-***')
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, 'AIza***')
    .replace(/(key|token|secret|authorization)(["'=:\s]+)[A-Za-z0-9_\-\.]{16,}/gi, '$1$2***')
    .slice(0, 2000);
}

/** Map an HTTP status to a failure class. */
export function classifyStatus(status: number): FailureClass {
  if ([408, 409, 425, 429, 500, 502, 503, 504, 529].includes(status)) return 'retryable';
  if ([400, 401, 403, 404, 422].includes(status)) return 'config';
  return 'unknown';
}
