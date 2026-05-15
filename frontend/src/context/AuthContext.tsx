import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getMe, login as apiLogin } from '../api/auth';
import type { AuthUser } from '../types/auth';

const STORAGE_KEY = 'car_parts_token';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; token: string; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Restore session on mount: if there is a stored token, validate it against
  // /api/auth/me. If it fails, clear the token and stay anonymous.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setState({ status: 'anonymous' });
      return;
    }

    let cancelled = false;
    getMe(stored)
      .then((user) => {
        if (cancelled) return;
        setState({ status: 'authenticated', token: stored, user });
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        setState({ status: 'anonymous' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem(STORAGE_KEY, res.token);
    // The login endpoint doesn't echo is_active; the user just authenticated,
    // so they're active by definition.
    setState({
      status: 'authenticated',
      token: res.token,
      user: { ...res.user, is_active: true },
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ status: 'anonymous' });
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
