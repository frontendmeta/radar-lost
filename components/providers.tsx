'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { isApiError, setQueryClient } from '@/lib/client/api';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            // One retry, but not for 4xx (auth / validation won't fix itself).
            retry: (failures, error) => failures < 1 && !(isApiError(error) && error.status >= 400 && error.status < 500),
            placeholderData: keepPreviousData,
          },
        },
      }),
  );
  useEffect(() => {
    setQueryClient(client);
    return () => setQueryClient(null);
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
