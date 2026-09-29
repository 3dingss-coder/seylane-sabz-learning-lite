// وضعیت جلسه‌ی کاربر در کل اپ.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, clearSession, getCachedUser, setSession, type User } from './api';

interface SessionCtx {
  user: User | null;
  ready: boolean;
  login: (phone: string) => Promise<User>;
  signup: (firstName: string, lastName: string, phone: string) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [ready, setReady] = useState(false);

  // اگر توکن ذخیره‌شده داریم، اعتبارش را یک بار بررسی می‌کنیم.
  useMemo(() => {
    if (!user) {
      setReady(true);
      return;
    }
    api<{ user: User }>('/api/me', {})
      .then((res) => setUser(res.user))
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (phone: string) => {
    const res = await api<{ token: string; user: User }>('/api/login', {
      method: 'POST',
      body: { phone },
      auth: false,
    });
    setSession(res.token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (firstName: string, lastName: string, phone: string) => {
    const res = await api<{ token: string; user: User }>('/api/signup', {
      method: 'POST',
      body: { firstName, lastName, phone },
      auth: false,
    });
    setSession(res.token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    location.hash = '#/';
  }, []);

  const value = useMemo(() => ({ user, ready, login, signup, logout }), [user, ready, login, signup, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession باید داخل SessionProvider استفاده شود');
  return ctx;
}
