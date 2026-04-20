import { createContext, useContext, useState, type ReactNode } from "react";
import { setWorkspaceProfileId } from "@workspace/api-client-react";

export interface WorkspaceInfo {
  profileId: number;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string;
  role: string;
}

interface WorkspaceContextValue {
  activeWorkspace: WorkspaceInfo | null;
  setActiveWorkspace: (w: WorkspaceInfo | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  activeWorkspace: null,
  setActiveWorkspace: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceInfo | null>(() => {
    try {
      const stored = localStorage.getItem("aido_active_workspace");
      const w: WorkspaceInfo | null = stored ? JSON.parse(stored) : null;
      // Initialize synchronously BEFORE the first render so React Query hooks
      // always send the correct x-workspace-profile-id header on their first fetch.
      setWorkspaceProfileId(w && w.role !== "owner" ? w.profileId : null);
      return w;
    } catch {
      return null;
    }
  });

  const setActiveWorkspace = (w: WorkspaceInfo | null) => {
    setActiveWorkspaceState(w);
    // Sync the workspace profile ID into the API client so every request
    // automatically fetches data from the right profile.
    setWorkspaceProfileId(w?.role !== "owner" ? (w?.profileId ?? null) : null);
    if (w) {
      localStorage.setItem("aido_active_workspace", JSON.stringify(w));
    } else {
      localStorage.removeItem("aido_active_workspace");
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
