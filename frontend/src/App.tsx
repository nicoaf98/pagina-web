import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';

function Topbar() {
  const { state, logout } = useAuth();
  if (state.status !== 'authenticated') return null;

  return (
    <header className="topbar">
      <div className="topbar__brand">Repuestos</div>
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

function AppRoutes() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <div className="state state--loading state--fullscreen">Cargando…</div>;
  }

  if (state.status === 'anonymous') {
    return <LoginPage />;
  }

  return (
    <>
      <Topbar />
      <ProductsPage />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
