import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/store/session';
import { cn } from '@/lib/utils';

export function WorkspaceSwitcher() {
  const workspaces = useSession((state) => state.workspaces);
  const activeWorkspaceId = useSession((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useSession((state) => state.setActiveWorkspace);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const active = workspaces.find((item) => item.publicId === activeWorkspaceId) ?? workspaces[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
            {active?.name?.slice(0, 1).toUpperCase() ?? 'R'}
          </span>
          <span className="truncate text-sm font-medium">{active?.name ?? '选择工作区'}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-card shadow-card">
            <ul className="max-h-64 overflow-y-auto py-1">
              {workspaces.map((workspace) => (
                <li key={workspace.publicId}>
                  <button
                    onClick={() => {
                      setActiveWorkspace(workspace.publicId);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted',
                      workspace.publicId === activeWorkspaceId ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span className="truncate">{workspace.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {workspace.role === 'owner' ? '所有者' : workspace.role === 'admin' ? '管理员' : '成员'}
                      </span>
                      {workspace.publicId === activeWorkspaceId ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                setOpen(false);
                navigate('/app/settings/workspace');
              }}
              className="flex w-full items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> 新建工作区
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
