// نقشه‌ی مسیرها. HashRouter انتخاب شده تا روی GitHub Pages بدون هیچ تنظیم سروری کار کند.
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useSession } from './store';
import { Spinner } from './components/ui';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Brands from './pages/Brands';
import Brand from './pages/Brand';
import Product from './pages/Product';
import Learn from './pages/Learn';
import Quiz from './pages/Quiz';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

/** اگر وارد نشده بود، به صفحه‌ی ورود می‌فرستد و مقصد را نگه می‌دارد. */
function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useSession();
  const loc = useLocation();
  if (!ready) return <Spinner label="در حال بررسی ورود…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/brands" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/brands" element={<RequireAuth><Brands /></RequireAuth>} />
      <Route path="/brands/:brandId" element={<RequireAuth><Brand /></RequireAuth>} />
      <Route path="/products/:productId" element={<RequireAuth><Product /></RequireAuth>} />
      <Route path="/learn/:contentId" element={<RequireAuth><Learn /></RequireAuth>} />
      <Route path="/quiz/:contentId" element={<RequireAuth><Quiz /></RequireAuth>} />
      <Route path="/me" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
