import { isApiError } from '@/lib/client/api';

export type ErrorKind = 'auth' | 'forbidden' | 'offline' | 'not_found' | 'generic';

export interface ErrorInfo {
  kind: ErrorKind;
  /** Page-level heading. */
  title: string;
  /** One plain sentence for the page or an inline banner. */
  body: string;
}

/** Turn anything thrown (ApiError, Error, string) into plain-language copy for a state screen. */
export function describeError(error: unknown): ErrorInfo {
  if (isApiError(error)) {
    if (error.status === 401) return { kind: 'auth', title: "You're signed out", body: 'Your session ended. Sign in again to pick up where you left off.' };
    if (error.status === 403) return { kind: 'forbidden', title: "This account can't open the radar", body: "That Google account isn't on the invite list. Sign in with your work account." };
    if (error.status === 0) return { kind: 'offline', title: "Can't reach the app", body: 'Check your connection, then try again.' };
    if (error.status === 404) return { kind: 'not_found', title: "This isn't on the radar", body: error.message || 'It may have been deleted, or the link is old.' };
    return { kind: 'generic', title: 'Something broke on this page', body: error.message || "Couldn't load this. Try again." };
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return { kind: 'offline', title: "Can't reach the app", body: 'Check your connection, then try again.' };
  }
  return { kind: 'generic', title: 'Something broke on this page', body: 'Your runs and settings are safe. Try again, or go back to the radar.' };
}
