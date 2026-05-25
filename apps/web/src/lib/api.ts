/**
 * Single fetch wrapper used by every page in the dashboard. Routes to the
 * real API in dev, or to an in-browser demo handler when:
 *  - NEXT_PUBLIC_DEMO is set to "true" at build time (Vercel), OR
 *  - we're on a non-localhost host and NEXT_PUBLIC_API_URL points at
 *    localhost (i.e. somebody deployed without setting the API URL).
 *
 * This is the reason the Vercel deploy works with zero backend.
 */
import { demoFetch } from './demoFetch';

const RAW_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const FORCE_DEMO = process.env.NEXT_PUBLIC_DEMO === 'true';

export const API_URL = RAW_API;

function shouldDemo(): boolean {
  if (FORCE_DEMO) return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  // Deployed but pointed at localhost = no usable API.
  return RAW_API.includes('localhost') || RAW_API.includes('127.0.0.1');
}

export function isDemo(): boolean {
  return shouldDemo();
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const isAbs = path.startsWith('http://') || path.startsWith('https://');
  if (shouldDemo()) {
    // For absolute URLs (e.g. presigned S3 PUTs) demoFetch can't help — let
    // them go to network as-is, then fail visibly.
    if (isAbs) return fetch(path, init);
    return demoFetch(path, init);
  }
  return fetch(isAbs ? path : `${RAW_API}${path}`, init);
}
