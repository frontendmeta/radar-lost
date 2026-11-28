'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, isTerminal, mockStore } from './api';

export interface Resource<T> {
  data: T | undefined;
  error: ApiError | Error | undefined;
  /** true until the first response for the current key arrives */
  loading: boolean;
  /** refetch in place (keeps showing the previous data) */
  reload: () => void;
}

/**
 * Fetch on mount / whenever `key` changes. Pass key=null to skip.
 * Backed by TanStack Query: results are cached per key (shared across screens), and the
 * previous data stays visible while a new key loads, so lens changes don't flash.
 */
export function useApi<T>(key: string | null, fetcher: () => Promise<T>): Resource<T> {
  const q = useQuery<T, ApiError | Error>({
    queryKey: [key],
    queryFn: () => fetcher(),
    enabled: key !== null,
  });
  const { refetch } = q;
  const enabled = key !== null;
  const reload = useCallback(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);
  return {
    data: q.data,
    error: q.error ?? undefined,
    loading: enabled && (q.isPending || q.isPlaceholderData),
    reload,
  };
}

/** Poll a run every `intervalMs` (2 s) until it reaches a terminal state. */
export function useRunPolling(runId: string | null | undefined, intervalMs = 2000) {
  const q = useQuery({
    // Same key as useApi(`run:${id}`), so the polled status feeds every screen showing this run.
    queryKey: [runId ? `run:${runId}` : null],
    queryFn: () => api.run(runId!),
    enabled: !!runId,
    staleTime: (query) => (query.state.data && isTerminal(query.state.data.status) ? 60_000 : 0),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && isTerminal(d.status)) return false;
      return query.state.status === 'error' ? intervalMs * 2 : intervalMs;
    },
  });
  const run = runId && !q.isPlaceholderData ? q.data : undefined;
  return {
    run,
    error: runId && !q.isPlaceholderData ? (q.error ?? undefined) : undefined,
    done: run ? isTerminal(run.status) : false,
  };
}

/** Warm the cache with the reads almost every screen needs (same keys the screens use). */
export function usePrefetchCommon() {
  const qc = useQueryClient();
  useEffect(() => {
    const reads: [string, () => Promise<unknown>][] = [
      ['me', api.me],
      ['setup', api.setup],
      ['health', api.health],
      ['runs', () => api.runs()],
      ['lens-options', api.lensOptions],
      ['settings', api.settings],
    ];
    for (const [key, fn] of reads) void qc.prefetchQuery({ queryKey: [key], queryFn: fn });
  }, [qc]);
}

/** True once any response in this tab was served from mocks. */
export function useUsingMocks(): boolean {
  return useSyncExternalStore(mockStore.subscribe, mockStore.getSnapshot, mockStore.getServerSnapshot) > 0;
}
