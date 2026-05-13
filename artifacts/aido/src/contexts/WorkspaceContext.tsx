import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { setWorkspaceProfileId } from "@workspace/api-client-react";
import { setAuthFetchWorkspaceProfileId } from "@/lib/authFetch";

function syncWorkspaceProfileId(id: number | null) {
  setWorkspaceProfileId(id);
  setAuthFetchWorkspaceProfileId(id);
}

export interface WorkspaceInfo {
  profileId: number;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  role: string;
}

interface StoredWorkspace {
  userId: string;
  workspace: WorkspaceInfo;
}

interface WorkspaceContextValue {
  activeWorkspace: WorkspaceInfo | null;
  setActiveWorkspace: (w: WorkspaceInfo | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  activeWorkspace: null,
  setActiveWorkspace: () => {},
});

const STORAGE_KEY = "aido_active_workspace";

// One-time migration: previous versions stored the active workspace in
// localStorage, which persists across sessions and silently rehydrated a
// shared workspace whenever a user signed back in. We've moved to
// sessionStorage so each new browser session starts in the user's own
// workspace by default. Wipe the legacy localStorage key so a stale entry
// can't be picked up by anything that might still read it.
try {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
} catch {
  // ignore — best-effort cleanup
}

function readStored(): StoredWorkspace | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Legacy format: bare WorkspaceInfo with no userId binding. Treat as
    // unbound so it gets discarded the moment we know who the current user
    // is — this prevents a freshly-signed-up user from inheriting a previous
    // user's cached collaborator workspace in the same browser.
    if (parsed && typeof parsed === "object" && "userId" in parsed && "workspace" in parsed) {
      return parsed as StoredWorkspace;
    }
    return null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceInfo | null>(() => {
    // We don't know who the user is yet on the first render. Start clean —
    // the auth-aware effect below will hydrate the cached workspace once
    // we've confirmed it belongs to the current user. This prevents a
    // previous user's collaborator workspace from leaking into a freshly-
    // signed-up user's session in the same browser.
    syncWorkspaceProfileId(null);
    return null;
  });

  // Once Clerk is loaded, validate the cached workspace against the current
  // user. If it belongs to a different user (or no one is signed in), wipe
  // it. This is the key guard that prevents a previous account's shared
  // workspace from leaking into a freshly-signed-up user's session in the
  // same browser.
  //
  // useLayoutEffect (not useEffect) so the workspace is resolved synchronously
  // before the browser paints. useEffect fires *after* paint, which lets
  // Dashboard render once with activeWorkspace=null, briefly show cached data,
  // then re-render with a non-owner workspace and return null — the "glitch".
  useLayoutEffect(() => {
    if (!isLoaded) return;
    const stored = readStored();

    if (!isSignedIn || !userId) {
      if (stored) sessionStorage.removeItem(STORAGE_KEY);
      setActiveWorkspaceState(null);
      syncWorkspaceProfileId(null);
      return;
    }

    if (!stored || stored.userId !== userId) {
      // Cache belongs to someone else — clear it.
      sessionStorage.removeItem(STORAGE_KEY);
      setActiveWorkspaceState(null);
      syncWorkspaceProfileId(null);
      return;
    }

    // Cache matches the current user — adopt it.
    setActiveWorkspaceState(stored.workspace);
    syncWorkspaceProfileId(
      stored.workspace.role !== "owner" ? stored.workspace.profileId : null,
    );
  }, [isLoaded, isSignedIn, userId]);

  // First-login collaborator bootstrap: if this signed-in user has no
  // workspace cached for this session, auto-open their single active shared
  // workspace so they see synced data immediately after accepting an invite.
  // We intentionally do NOT overwrite an existing session selection.
  useLayoutEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (activeWorkspace) return;
    const stored = readStored();
    if (stored?.userId === userId && stored.workspace) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const r = await fetch("/api/collaborators/my-workspaces", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok || cancelled) return;
        const body = await r.json() as {
          ownProfile: { profileId: number; partner1Name: string; partner2Name: string; weddingDate: string } | null;
          sharedWorkspaces: Array<{ profileId: number; role: string; partner1Name: string; partner2Name: string; weddingDate: string; status: string }>;
        };
        if (cancelled) return;
        // If the account has exactly one active shared workspace and no own
        // profile, default into that shared workspace.
        if (!body.ownProfile && body.sharedWorkspaces.length === 1) {
          const w = body.sharedWorkspaces[0];
          setActiveWorkspaceState({
            profileId: w.profileId,
            role: w.role,
            partner1Name: w.partner1Name,
            partner2Name: w.partner2Name,
            weddingDate: w.weddingDate,
          });
          syncWorkspaceProfileId(w.profileId);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, workspace: {
            profileId: w.profileId,
            role: w.role,
            partner1Name: w.partner1Name,
            partner2Name: w.partner2Name,
            weddingDate: w.weddingDate,
          } }));
        }
      } catch {
        // best-effort bootstrap only
      }
    })();
    return () => { cancelled = true; };
  }, [activeWorkspace, getToken, isLoaded, isSignedIn, userId]);

  const setActiveWorkspace = (w: WorkspaceInfo | null) => {
    setActiveWorkspaceState(w);
    syncWorkspaceProfileId(w?.role !== "owner" ? (w?.profileId ?? null) : null);
    if (w && userId) {
      const payload: StoredWorkspace = { userId, workspace: w };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
