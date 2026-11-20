import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser, WorkspaceSummary } from '@/types/api';

type SessionState = {
  user: PublicUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  setSession: (user: PublicUser, workspaces: WorkspaceSummary[]) => void;
  setUser: (user: PublicUser) => void;
  setWorkspaces: (workspaces: WorkspaceSummary[]) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  clear: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      workspaces: [],
      activeWorkspaceId: null,
      setSession: (user, workspaces) => {
        const current = get().activeWorkspaceId;
        const stillValid = workspaces.some((item) => item.publicId === current);
        set({
          user,
          workspaces,
          activeWorkspaceId: stillValid && current ? current : (workspaces[0]?.publicId ?? null),
        });
      },
      setUser: (user) => set({ user }),
      setWorkspaces: (workspaces) => {
        const current = get().activeWorkspaceId;
        const stillValid = workspaces.some((item) => item.publicId === current);
        set({
          workspaces,
          activeWorkspaceId: stillValid && current ? current : (workspaces[0]?.publicId ?? null),
        });
      },
      setActiveWorkspace: (workspaceId) => set({ activeWorkspaceId: workspaceId }),
      clear: () => set({ user: null, workspaces: [], activeWorkspaceId: null }),
    }),
    { name: 'reviewmonitor-session', partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId }) },
  ),
);

export function useActiveWorkspace() {
  const workspaces = useSession((state) => state.workspaces);
  const activeWorkspaceId = useSession((state) => state.activeWorkspaceId);
  return workspaces.find((item) => item.publicId === activeWorkspaceId) ?? null;
}

export function useCanManage() {
  const workspace = useActiveWorkspace();
  return workspace?.role === 'owner' || workspace?.role === 'admin';
}
