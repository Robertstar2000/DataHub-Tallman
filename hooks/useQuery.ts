
import { useState, useEffect, useRef, useCallback } from 'react';

interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

const cache = new Map<string, { data: any; timestamp: number }>();
const querySubscribers = new Map<string, Set<() => void>>();

const DEFAULT_STALE_TIME = 1000 * 60; // 1 minute

export const useQuery = <T,>(
  queryKey: readonly (string | number)[],
  queryFn: () => Promise<T>,
  options: { enabled?: boolean, staleTime?: number } = {}
): QueryState<T> => {
  const { enabled = true, staleTime = DEFAULT_STALE_TIME } = options;
  const queryKeyString = JSON.stringify(queryKey);
  
  const [state, setState] = useState<Omit<QueryState<T>, 'refetch'>>(() => {
      const cached = cache.get(queryKeyString);
      if (cached && (Date.now() - cached.timestamp < staleTime)) {
          return { data: cached.data, isLoading: false, error: null, isSuccess: true };
      }
      return { data: undefined, isLoading: enabled, error: null, isSuccess: false };
  });

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!isRefetch) {
      setState(prevState => ({ ...prevState, isLoading: true }));
    }
    try {
      const data = await queryFnRef.current();
      cache.set(queryKeyString, { data, timestamp: Date.now() });
      setState({ data, isLoading: false, error: null, isSuccess: true });
      // Notify other subscribers of the same query key
      querySubscribers.get(queryKeyString)?.forEach(callback => callback());
    } catch (e: any) {
      setState({ data: undefined, isLoading: false, error: e, isSuccess: false });
    }
  }, [queryKeyString]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const cached = cache.get(queryKeyString);
    if (cached && (Date.now() - cached.timestamp < staleTime)) {
        if (state.data !== cached.data) {
            setState({ data: cached.data, isLoading: false, error: null, isSuccess: true });
        }
        return;
    }
    
    fetchData();
  }, [queryKeyString, enabled, staleTime, state.data, fetchData]);

  // Subscribe to updates from other hooks using the same key
  useEffect(() => {
    const callback = () => {
        const cached = cache.get(queryKeyString);
        if (cached) {
            setState({ data: cached.data, isLoading: false, error: null, isSuccess: true });
        }
    };

    if (!querySubscribers.has(queryKeyString)) {
        querySubscribers.set(queryKeyString, new Set());
    }
    querySubscribers.get(queryKeyString)!.add(callback);

    return () => {
        querySubscribers.get(queryKeyString)?.delete(callback);
    };
  }, [queryKeyString]);


  return { ...state, refetch: () => fetchData(true) };
};

// Function to invalidate queries, useful for mutations
export const invalidateQuery = (queryKey: readonly (string | number)[]) => {
    const queryKeyString = JSON.stringify(queryKey);
    cache.delete(queryKeyString);
};
