let _getToken: (() => Promise<string | null>) | null = null;
let _workspaceProfileId: number | null = null;

export function setFetchTokenGetter(getter: (() => Promise<string | null>) | null) {
  _getToken = getter;
}

export function setAuthFetchWorkspaceProfileId(id: number | null): void {
  _workspaceProfileId = id;
}

function getActiveWorkspaceProfileId(): number | null {
  if (_workspaceProfileId != null) return _workspaceProfileId;
  // Fallback: read directly from localStorage so requests fired before
  // the WorkspaceContext mounts still hit the right workspace.
  try {
    const stored = localStorage.getItem("aido_active_workspace");
    if (!stored) return null;
    const w = JSON.parse(stored) as { profileId?: number; role?: string } | null;
    if (!w || w.role === "owner") return null;
    return typeof w.profileId === "number" ? w.profileId : null;
  } catch {
    return null;
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  const wsId = getActiveWorkspaceProfileId();
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(wsId != null ? { "x-workspace-profile-id": String(wsId) } : {}),
    },
  });
}
