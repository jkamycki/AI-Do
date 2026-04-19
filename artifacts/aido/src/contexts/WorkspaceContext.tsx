import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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
      return stored ? JSON.parse(stored) : null;
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

  // On mount, restore the workspace profile ID from localStorage into the API client.
  useEffect(() => {
    if (activeWorkspace && activeWorkspace.role !== "owner") {
      setWorkspaceProfileId(activeWorkspace.profileId);
    } else {
      setWorkspaceProfileId(null);
    }
  }, []);

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
