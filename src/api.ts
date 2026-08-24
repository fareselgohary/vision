import type { DashboardData, Group, GroupDetails } from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'حدث خطأ غير متوقع. حاول مرة أخرى.');
  return body as T;
}

export const api = {
  getGroups: () => request<{ groups: Group[] }>('/groups'),
  lookupRegistration: (registrationNumber: string) =>
    request<{ registration: { groupNumber: number; academicYear: number } | null }>(`/registration?registrationNumber=${encodeURIComponent(registrationNumber)}`),
  register: (payload: { registrationNumber: string; academicYear: number; groupId: string }) =>
    request<{ registration: { groupNumber: number; academicYear: number; wasChanged: boolean; alreadyRegistered: boolean } }>('/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  dashboard: (token: string, search = '', year = '') =>
    request<DashboardData>(`/admin/dashboard?search=${encodeURIComponent(search)}&year=${year}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  groupDetails: (token: string, groupId: string) =>
    request<GroupDetails>(`/admin/groups/${encodeURIComponent(groupId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  setYearAvailability: (token: string, academicYear: number, isOpen: boolean) =>
    request<{ groups: Group[] }>(`/admin/years/${academicYear}/availability`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isOpen }),
    }),
};
