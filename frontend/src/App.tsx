import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { AdminProductsPage } from './pages/AdminProductsPage';

type View = 'catalog' | 'admin-products';

interface TopbarProps {
  view: View;
  onSelect: (v: View) => void;
  canAdmin: boolean;
}

function Topbar({ view, onSelect, canAdmin }: TopbarProps) {
  const { state, logout } = useAuth();
  if (state.status !== 'authenticated') return null;

  return (
    <header className="topbar">
      <div className="topbar__brand">Repuestos</div>

      <nav className="topbar__nav">
        <button
          type="button"
          className={
            view === 'catalog'
              ? 'topbar__nav-btn topbar__nav-btn--active'
              : 'topbar__nav-btn'
          }
          onClick={() => onSelect('catalog')}
        >
          Catálogo
        </button>
        {canAdmin && (
          <button
            type="button"
            className={
              view === 'admin-products'
                ? 'topbar__nav-btn topbar__nav-btn--active'
                : 'topbar__nav-btn'
            }
            onClick={() => onSelect('admin-products')}
          >
            Admin productos
          </button>
        )}
      </nav>

      <div className="topbar__user">
        <span className="topbar__user-name">{state.user.full_name}</span>
        <span className="topbar__user-role">({state.user.role})</span>
        <button type="button" className="topbar__logout" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

function AuthenticatedShell() {
  const { state } = useAuth();
  const [view, setView] = useState<View>('catalog');

  if (state.status !== 'authenticated') return null;

  const canAdmin = state.user.role === 'admin' || state.user.role === 'seller';
  // If the role lost admin access mid-session, force back to catalog.
  const effectiveView: View = canAdmin ? view : 'catalog';

  return (
    <>
      <Topbar view={effectiveView} onSelect={setView} canAdmin={canAdmin} />
      {effectiveView === 'admin-products' ? <AdminProductsPage /> : <ProductsPage />}
    </>
  );
}

function AppRoutes() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <div className="state state--loading state--fullscreen">Cargando…</div>;
  }

  if (state.status === 'anonymous') {
    return <LoginPage />;
  }

  return <AuthenticatedShell />;
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
