import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_AIDO_API_URL?.replace(/\/+$/, '') ?? '';
const AUTH_TOKEN_STORAGE_KEY = 'aido.mobile.authToken';

let authTokenGetter: (() => Promise<string | null>) | null = null;
let workspaceProfileId: number | null = null;

export function setMobileAuthTokenGetter(getter: (() => Promise<string | null>) | null) {
  authTokenGetter = getter;
}

export function setMobileWorkspaceProfileId(profileId: number | null) {
  workspaceProfileId = profileId;
}

export async function saveMobileAuthToken(token: string | null) {
  const trimmed = token?.trim();
  if (trimmed) {
    await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, trimmed);
    return;
  }
  await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function getMobileAuthToken() {
  const fromGetter = authTokenGetter ? await authTokenGetter() : null;
  if (fromGetter?.trim()) return fromGetter.trim();

  const fromEnv = process.env.EXPO_PUBLIC_AIDO_AUTH_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const fromStorage = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return fromStorage?.trim() || null;
}

export function hasMobileApiBase() {
  return Boolean(API_BASE);
}

export async function mobileAuthFetch(path: string, init: RequestInit = {}) {
  if (!API_BASE) return null;

  const token = await getMobileAuthToken();
  if (!token) return null;

  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(workspaceProfileId != null ? { 'x-workspace-profile-id': String(workspaceProfileId) } : {}),
    },
  });
}

export async function mobileAuthJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await mobileAuthFetch(path, init);
  if (!response) {
    throw new Error(!API_BASE ? 'Mobile API URL is not configured.' : 'Sign in is required to sync this change.');
  }

  if (!response.ok) {
    let message = 'Request failed.';
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      // Keep the generic message when the server does not send JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}
