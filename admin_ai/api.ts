import { api, getApiError } from '../src/services/api';

export type Query = Record<string, string | number | boolean | undefined>;

export const adminApi = {
  async get<T>(path: string, params?: Query): Promise<T> {
    const response = await api.get<T>(`/api/admin${path}`, { params });
    return response.data;
  },
  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await api.post<T>(`/api/admin${path}`, body);
    return response.data;
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await api.patch<T>(`/api/admin${path}`, body);
    return response.data;
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await api.put<T>(`/api/admin${path}`, body);
    return response.data;
  },
  async remove<T>(path: string): Promise<T> {
    const response = await api.delete<T>(`/api/admin${path}`);
    return response.data;
  },
  async download(path: string, filename: string) {
    const response = await api.get(`/api/admin${path}`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};

export { getApiError };
