"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "next-auth/react";
import {
  formatBytes,
  getFileType,
  getProjectColor,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import type { ApiProject, ApiProjectFile } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  LogOut,
  Upload,
  HardDrive,
  Folder as FolderIcon,
  type LucideIcon,
} from "lucide-react";
import {
  FileText as DocIcon,
  Map,
  FileBarChart,
  Image as ImageIcon,
  ScanLine,
} from "lucide-react";

const FILE_TYPE_ICONS: Record<string, LucideIcon> = {
  doc: DocIcon,
  map: Map,
  report: FileBarChart,
  image: ImageIcon,
  survey: ScanLine,
  file: FileText,
};

// ─── Sidebar folder item ──────────────────────────────────────────────────────

function SidebarFolder({
  project,
  index,
  active,
}: {
  project: ApiProject;
  index: number;
  active: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const open = active || manualOpen;
  const color = getProjectColor(index);
  const files = project.files ?? [];

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md ${
          active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
        }`}
      >
        <button
          onClick={() => setManualOpen((o) => !o)}
          className="p-1.5 text-sidebar-foreground/60"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <Link
          href={`/dashboard/folder?folderId=${project.id}`}
          className="flex flex-1 items-center gap-2 py-1.5 pr-2 text-sm"
        >
          <FolderIcon className="h-3.5 w-3.5" style={{ color }} />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40">
            {project._count?.files ?? files.length}
          </span>
        </Link>
      </div>

      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-5 ml-3">
          {files.length === 0 ? (
            <li className="py-1 text-[11px] text-sidebar-foreground/40">
              Empty
            </li>
          ) : (
            files.map((file) => {
              const Icon = FILE_TYPE_ICONS[getFileType(file)] ?? FileText;
              return (
                <li key={file.id}>
                  <Link
                    href={`/dashboard/file?folderId=${project.id}&fileId=${file.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      )}
    </li>
  );
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function RightPanel() {
  const { projects } = useProjectFolders();
  const [q, setQ] = useState("");

  const totalFiles = projects.reduce(
    (acc, p) => acc + (p._count?.files ?? p.files?.length ?? 0),
    0,
  );

  // Search across all loaded files
  type Match = { project: ApiProject; file: ApiProjectFile };
  const matches: Match[] = q.trim()
    ? projects.flatMap((project) =>
        (project.files ?? [])
          .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
          .map((file) => ({ project, file })),
      )
    : [];

  // Storage — static placeholder until a real /api/storage endpoint exists
  const used = 32.4;
  const total = 50;
  const pct = (used / total) * 100;

  return (
    <aside className="border-l border-border bg-card/40 p-5 overflow-y-auto flex flex-col">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search files…"
          className="pl-9 bg-background"
        />
      </div>

      {q && (
        <div className="mt-3 space-y-1">
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              No files match.
            </p>
          ) : (
            matches.slice(0, 8).map(({ project, file }) => (
              <Link
                key={file.id}
                href={`/dashboard/file?folderId=${project.id}&fileId=${file.id}`}
                className="block rounded-md p-2 text-xs hover:bg-accent"
              >
                <div className="font-medium text-foreground truncate">
                  {file.name}
                </div>
                <div className="text-muted-foreground">{project.name}</div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* At a glance */}
      <div className="mt-6">
        <p className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          At a glance
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">Folders</div>
            <div className="font-display text-2xl text-primary">
              {projects.length}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">Files</div>
            <div className="font-display text-2xl text-primary">
              {totalFiles}
            </div>
          </div>
        </div>
      </div>

      {/* Storage */}
      <div className="mt-auto pt-6">
        <div className="rounded-xl border border-border bg-background p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-teal" />
            <div className="text-sm font-medium">Storage</div>
            <div className="ml-auto text-xs text-muted-foreground">
              {used} / {total} GB
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pct < 70
              ? "Plenty of space remaining."
              : pct < 90
                ? "Filling up — review archives."
                : "Almost full."}
          </p>
          <Button variant="outline" size="sm" className="mt-3 w-full">
            <Upload className="mr-1 h-3.5 w-3.5" /> Upload file
          </Button>
        </div>
      </div>
    </aside>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { projects } = useProjectFolders();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr_300px] bg-background">
      {/* Sidebar */}
      <aside className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ backgroundColor: "var(--gold)" }}
            >
              <span className="font-display text-sm text-primary">T</span>
            </div>
            <div>
              <div className="text-sm font-medium text-sidebar-foreground">
                Terra Line
              </div>
              <div className="text-[10px] tracking-widest uppercase text-sidebar-foreground/50">
                Workspace
              </div>
            </div>
          </Link>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto">
          <div className="px-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            Folders
          </div>
          <ul className="mt-2 space-y-0.5">
            {projects.map((project, index) => (
              <SidebarFolder
                key={project.id}
                project={project}
                index={index}
                active={pathname.includes(`folderId=${project.id}`)}
              />
            ))}
          </ul>
        </div>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm">
              {user.email!.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user.email}</div>
              <div className="text-[10px] text-sidebar-foreground/50">
                Signed in
              </div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="overflow-y-auto">{children}</main>

      <RightPanel />
    </div>
  );
}
