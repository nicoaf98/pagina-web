export type UserRole = 'admin' | 'seller' | 'customer';

// Full user shape, as returned by GET /api/auth/me.
export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

// Body of POST /api/auth/login.
export interface LoginPayload {
  email: string;
  password: string;
}

// Response of POST /api/auth/login. The backend doesn't include is_active here
// (only on /me) — we treat the freshly-logged-in user as active by definition.
export interface LoginResponse {
  token: string;
  user: Pick<AuthUser, 'id' | 'email' | 'full_name' | 'role'>;
}
