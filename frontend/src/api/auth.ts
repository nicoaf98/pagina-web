import { apiGet, apiPost } from './client';
import type { AuthUser, LoginResponse } from '../types/auth';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/auth/login', { email, password });
}

export function getMe(token: string): Promise<AuthUser> {
  return apiGet<AuthUser>('/api/auth/me', { token });
}
