// وضعیت جلسه‌ی کاربر در کل اپ.
//
// نکته‌ی مهم: همه‌ی جابه‌جایی‌ها با useNavigate انجام می‌شوند، نه با
// تغییر دستی location.hash. تغییر دستی با React Router مسابقه می‌دهد و
// باعث می‌شد کاربر بعد از خروج به صفحه‌ی ورود پرتاب شود.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  ApiError,
  clearSession,
  getCachedUser,
  getToken,
  setUnauthorizedHandler,
  setSession,
  type User,
} from './api';

interface SessionCtx {
  user: User | null;
  /** تا وقتی اعتبار توکن بررسی نشده، false است */
  ready: boolean;
  /** پیامی که باید در صفحه‌ی ورود نشان داده شود (مثلاً پایان جلسه) */
  notice: string;
  /** در لحظه‌ی خروج true است تا RequireAuth مسابقه نکند */
  loggingOut: boolean;
  clearNotice: () => void;
  login: (phone: string) => Promise<User>;
  signup: (firstName: string, lastName: string, phone: string) => Promise<User>;
  logout: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    // اگر توکنی نداریم، کاربر کش‌شده اعتباری ندارد.
    return getToken() ? getCachedUser() : null;
  });
  // اگر توکنی نیست چیزی برای بررسی نیست؛ بلافاصله آماده‌ایم.
  const [ready, setReady] = useState<boolean>(() => !getToken());
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // اگر توکن ذخیره‌شده داریم، یک بار اعتبارش را بررسی می‌کنیم.
  // این یک side effect است، پس باید در useEffect باشد (نه useMemo).
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    if (!getCachedUser()) {
      // توکن هست ولی کاربری در حافظه نیست — وضعیت را از سرور می‌گیریم.
    }
    let alive = true;
    api<{ user: User }>('/api/me', { unauthorized: 'silent' })
      .then((res) => {
        if (alive) {
          setUser(res.user);
          setSession(token, res.user);
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        // فقط وقتی توکن واقعاً باطل است (401) جلسه را دور می‌ریزیم.
        // خطای شبکه یا خطای سرور دلیل بر پایان جلسه نیست — کاربر را
        // وارد نگه می‌داریم تا با برگشتن اتصال، بدون ورود دوباره ادامه دهد.
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          setUser(null);
          setNotice('جلسه‌ی شما تمام شده بود. دوباره وارد شوید.');
        } else {
          setNotice('اتصال به سرور برقرار نشد. وارد هستید؛ کمی دیگر دوباره تلاش کنید.');
        }
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // هر درخواستی که 401 بگیرد یعنی توکن باطل است → خروج تمیز.
  // به‌جای پرش مستقیم، فقط کاربر را خالی می‌کنیم تا RequireAuth
  // از مسیر معمول و بدون مسابقه به صفحه‌ی ورود بفرستد.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
      setNotice('جلسه‌ی شما تمام شد. لطفاً دوباره وارد شوید.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(
    async (phone: string) => {
      const res = await api<{ token: string; user: User }>('/api/login', {
        method: 'POST',
        body: { phone },
        auth: false,
      });
      setSession(res.token, res.user);
      setNotice('');
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const signup = useCallback(async (firstName: string, lastName: string, phone: string) => {
    const res = await api<{ token: string; user: User }>('/api/signup', {
      method: 'POST',
      body: { firstName, lastName, phone },
      auth: false,
    });
    setSession(res.token, res.user);
    setNotice('');
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    // ترتیب مهم است: اول توکن پاک و جابه‌جایی انجام شود، بعد کاربر خالی شود.
    // اگر اول setUser(null) کنیم، RequireAuth همان لحظه <Navigate to="/login">
    // رندر می‌کند و کاربر به‌جای صفحه‌ی اصلی، در صفحه‌ی ورود می‌افتد.
    clearSession();
    setLoggingOut(true);
    navigate('/', { replace: true });
    setUser(null);
    setNotice('');
    // پرچم را بعد از نشست‌دادن رندر برمی‌داریم
    setTimeout(() => setLoggingOut(false), 0);
  }, [navigate]);

  const clearNotice = useCallback(() => setNotice(''), []);

  const value = useMemo(
    () => ({ user, ready, notice, clearNotice, loggingOut, login, signup, logout }),
    [user, ready, notice, clearNotice, loggingOut, login, signup, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession باید داخل SessionProvider استفاده شود');
  return ctx;
}
