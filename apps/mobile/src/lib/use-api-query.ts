import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '@/lib/api';

// `path` null olduğunda istek atılmaz (ör. henüz seçili bir öğrenci yokken).
export function useApiQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!path) {
        setLoading(false);
        return;
      }
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const result = await api.get<T>(path);
        setData(result);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Beklenmeyen bir hata oluştu');
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, refreshing, error, refetch: () => load(true) };
}
