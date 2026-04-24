import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

function readStored(): StoredWorkspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  const { isLoaded, isSignedIn, userId } = useAuth();

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
  useEffect(() => {
    if (!isLoaded) return;
    const stored = readStored();

    if (!isSignedIn || !userId) {
      if (stored) localStorage.removeItem(STORAGE_KEY);
      setActiveWorkspaceState(null);
      syncWorkspaceProfileId(null);
      return;
    }

    if (!stored || stored.userId !== userId) {
      // Cache belongs to someone else — clear it.
      localStorage.removeItem(STORAGE_KEY);
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

  const setActiveWorkspace = (w: WorkspaceInfo | null) => {
    setActiveWorkspaceState(w);
    syncWorkspaceProfileId(w?.role !== "owner" ? (w?.profileId ?? null) : null);
    if (w && userId) {
      const payload: StoredWorkspace = { userId, workspace: w };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(STORAGE_KEY);
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
