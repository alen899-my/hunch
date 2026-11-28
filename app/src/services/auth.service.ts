import { apiRequest } from './api';

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  provider: 'local' | 'google';
}

export interface AuthPayload {
  token: string;
  user: User;
}

// Register with email or phone + password
export const register = (data: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
}) => apiRequest<AuthPayload>('/auth/register', { method: 'POST', body: data });

// Login with email or phone + password
export const login = (data: { email?: string; phone?: string; password: string }) =>
  apiRequest<AuthPayload>('/auth/login', { method: 'POST', body: data });

// Google Sign-In — pass the idToken from expo-auth-session / google-signin
export const googleSignIn = (idToken: string) =>
  apiRequest<AuthPayload>('/auth/google', { method: 'POST', body: { idToken } });

// Get current user (requires token)
export const getMe = (token: string) =>
  apiRequest<{ user: User }>('/auth/me', { token });

// Update current user profile
export const updateMe = (
  data: { name?: string; phone?: string | null; avatar?: string | null },
  token?: string | null
) =>
  apiRequest<{ user: User }>('/auth/me', {
    method: 'PATCH',
    body: data,
    token,
  });

// Change password using old and new password
export const changePassword = (
  data: { oldPassword?: string; newPassword: string },
  token?: string | null
) =>
  apiRequest<{ updated: boolean; token?: string }>('/auth/change-password', {
    method: 'POST',
    body: data,
    token,
  });
