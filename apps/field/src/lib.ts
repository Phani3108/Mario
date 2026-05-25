export const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000';

export function getToken(): string | null {
  return localStorage.getItem('sf_token');
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem('sf_token', t);
  else localStorage.removeItem('sf_token');
}
export function getUser(): { id: string; name: string; role: string; siteId: string | null; orgId: string } | null {
  const v = localStorage.getItem('sf_user');
  return v ? JSON.parse(v) : null;
}
export function setUser(u: any) {
  if (u) localStorage.setItem('sf_user', JSON.stringify(u));
  else localStorage.removeItem('sf_user');
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error ?? msg; } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function deviceId(): string {
  let d = localStorage.getItem('sf_device');
  if (!d) {
    d = (crypto as any).randomUUID?.() ?? `dev-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('sf_device', d!);
  }
  return d!;
}

export function getGeo(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('geolocation unavailable'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 10_000, maximumAge: 0,
    });
  });
}
