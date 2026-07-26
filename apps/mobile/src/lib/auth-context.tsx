import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ApiError } from '@/lib/api';
import type { Me } from '@/lib/types';

const ME_CACHE_KEY = 'seviye360.me-cache';

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get<Me>('/api/me');
      setUser(me);
      await AsyncStorage.setItem(ME_CACHE_KEY, JSON.stringify(me));
    } catch (err) {
      setUser(null);
      await AsyncStorage.removeItem(ME_CACHE_KEY);
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Soğuk başlangıçta önbellekten hemen göster (algılanan hız için),
      // ardından /api/me ile sessizce doğrula — oturum sonlanmışsa temizlenir.
      const cached = await AsyncStorage.getItem(ME_CACHE_KEY);
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          // bozuk önbellek, yok say
        }
      }
      try {
        await refreshMe();
      } catch {
        // sessizce yut — kullanıcı zaten login ekranına düşecek
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await api.post('/api/auth/login', { email, password });
        await refreshMe();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Giriş yapılamadı';
        setError(message);
        throw err;
      }
    },
    [refreshMe],
  );

  const clearSession = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(ME_CACHE_KEY);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/api/auth/logout-all');
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, logoutAll, refreshMe }),
    [user, loading, error, login, logout, logoutAll, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  return ctx;
}
