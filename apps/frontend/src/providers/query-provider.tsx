'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create a stable QueryClient per component tree (not module-level singleton)
  // so that tests and SSR don't share state between requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Only refetch stale data when the window regains focus in production
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            // Retry once on failure (network hiccup), then surface the error
            retry: 1,
            // Consider data stale after 30s
            staleTime: 30_000,
          },
          mutations: {
            // Don't retry mutations — they may not be idempotent
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
