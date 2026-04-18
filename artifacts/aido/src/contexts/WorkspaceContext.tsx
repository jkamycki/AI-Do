import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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
