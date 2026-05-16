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
  // SECURITY: only return what WorkspaceContext has explicitly set via
  // setAuthFetchWorkspaceProfileId. The previous implementation fell back to
  // reading localStorage directly, which let a stale cache from a previous
  // sign-in leak the wrong workspace's profile id into another account's
  // requests (cross-account data leak on the seating chart's guest import).
  return _workspaceProfileId;
}

function getInternalTrackingHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const isTestMode = window.localStorage.getItem("aido_test_account_mode") === "true";
    const sessionId = window.localStorage.getItem(isTestMode ? "aido_test_anonymous_session_id" : "aido_anonymous_session_id");
    return {
      ...(isTestMode ? { "x-aido-test-mode": "true" } : {}),
      ...(sessionId ? { "x-aido-session-id": sessionId } : {}),
    };
  } catch {
    return {};
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
      ...getInternalTrackingHeaders(),
    },
  });
}
