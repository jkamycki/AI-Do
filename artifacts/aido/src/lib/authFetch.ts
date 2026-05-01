let _getToken: (() => Promise<string | null>) | null = null;
let _workspaceProfileId: number | null = null;
let _baseUrl: string | null = null;

export function setFetchTokenGetter(getter: (() => Promise<string | null>) | null) {
  _getToken = getter;
}

export function setAuthFetchWorkspaceProfileId(id: number | null): void {
  _workspaceProfileId = id;
}

export function setAuthFetchBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

function applyBase(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (!url.startsWith("/")) return input;
  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (input instanceof URL) return new URL(absolute);
  return new Request(absolute, input as Request);
}

function getActiveWorkspaceProfileId(): number | null {
  if (_workspaceProfileId != null) return _workspaceProfileId;
  try {
    const stored = localStorage.getItem("aido_active_workspace");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as
      | { userId?: string; workspace?: { profileId?: number; role?: string } }
      | null;
    const w = parsed?.workspace;
    if (!parsed?.userId || !w || w.role === "owner") return null;
    return typeof w.profileId === "number" ? w.profileId : null;
  } catch {
    return null;
  }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(applyBase(input), init);
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  const wsId = getActiveWorkspaceProfileId();
  return fetch(applyBase(input), {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(wsId != null ? { "x-workspace-profile-id": String(wsId) } : {}),
    },
  });
}
