let _getToken: (() => Promise<string | null>) | null = null;

export function setFetchTokenGetter(getter: (() => Promise<string | null>) | null) {
  _getToken = getter;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
