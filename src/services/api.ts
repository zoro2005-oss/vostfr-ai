import axios from 'axios';
import type { AuthResponse } from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vostfr_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vostfr_token');
      localStorage.removeItem('vostfr_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const endpoints = {
  register: '/api/auth/register',
  login: '/api/auth/login',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  me: '/api/auth/me',
  updateMe: '/api/auth/me',
  upload: '/api/projects/upload',
  projects: '/api/projects',
  project: (id: number | string) => `/api/projects/${id}`,
  translate: (id: number | string) => `/api/projects/${id}/translate`,
  progress: (id: number | string) => `/api/projects/${id}/progress`,
  subtitles: (id: number | string) => `/api/projects/${id}/subtitles`,
  download: (id: number | string) => `/api/projects/${id}/download`,
  delete: (id: number | string) => `/api/projects/${id}`
};

export function saveSession(data: AuthResponse) {
  localStorage.setItem('vostfr_token', data.access_token);
  if (data.user) {
    localStorage.setItem('vostfr_user', JSON.stringify(data.user));
  }
}

export function clearSession() {
  localStorage.removeItem('vostfr_token');
  localStorage.removeItem('vostfr_user');
}

export function saveStoredUser(user: { id: number; email: string; full_name?: string }) {
  localStorage.setItem('vostfr_user', JSON.stringify(user));
}

export function getStoredUser() {
  const raw = localStorage.getItem('vostfr_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: number; email: string; full_name?: string };
  } catch {
    return null;
  }
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
    return error.message;
  }
  return 'Une erreur est survenue';
}
