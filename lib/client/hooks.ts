'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RunStatus } from '@/lib/api-types';
import { ApiError, api, isTerminal, mockStore } from './api';

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | Error | undefined;
  /** true until the first response for the current key arrives */
  loading: boolean;
  /** refetch in place (keeps showing the previous data) */
  reload: () => void;
}

type Slot<T> = { key: string | null; data?: T; error?: ApiError | Error };

/**
 * Fetch on mount / whenever `key` changes. Pass key=null to skip.
 * Keeps the last data while a new key loads, so lens changes don't flash.
 */
export function useApi<T>(key: string | null, fetcher: () => Promise<T>): Resource<T> {
  const [slot, setSlot] = useState<Slot<T>>({ key: null });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetcherRef.current().then(
      (data) => !cancelled && setSlot({ key, data }),
      (error: unknown) =>
        !cancelled && setSlot((s) => ({ key, data: s.data, error: error instanceof Error ? error : new Error(String(error)) })),
    );
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const fresh = slot.key === key;
  return {
    data: slot.data,
    error: fresh ? slot.error : undefined,
    loading: key !== null && !fresh,
    reload,
  };
}

/** Poll a run every `intervalMs` (2 s) until it reaches a terminal state. */
export function useRunPolling(runId: string | null | undefined, intervalMs = 2000) {
  const [state, setState] = useState<{ id: string | null; run?: RunStatus; error?: ApiError | Error }>({ id: null });

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const run = await api.run(runId);
        if (cancelled) return;
        setState({ id: runId, run });
        if (!isTerminal(run.status)) timer = setTimeout(tick, intervalMs);
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ id: runId, run: s.id === runId ? s.run : undefined, error: e instanceof Error ? e : new Error(String(e)) }));
        timer = setTimeout(tick, intervalMs * 2);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, intervalMs]);

  const fresh = state.id === runId;
  const run = fresh ? state.run : undefined;
  return {
    run,
    error: fresh ? state.error : undefined,
    done: run ? isTerminal(run.status) : false,
  };
}

/** True once any response in this tab was served from mocks. */
export function useUsingMocks(): boolean {
  return useSyncExternalStore(mockStore.subscribe, mockStore.getSnapshot, mockStore.getServerSnapshot) > 0;
}
