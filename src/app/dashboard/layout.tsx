"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "next-auth/react";
import {
  formatBytes,
  getFileType,
  useProjectFolders,
  useStorage,
} from "@/hooks/use-project-folders";
import { FOLDERS, getProjectFolderKey, type FolderDef } from "@/lib/folders";
import type { ApiFolder, ApiProject, ApiProjectFile } from "@/types/domain";
import { Progress } from "@/components/ui/progress";
import { ProfileDialog } from "@/components/profile-dialog";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Search,
  ShieldCheck,
  LogOut,
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

// ─── Sidebar search (файлыг нэрээр нь хайна) ──────────────────────────────────

type SearchResult = {
  id: string;
  name: string;
  mimeType: string;
  projectId: string;
  project: { name: string };
};

function SidebarSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Бичих бүрт биш — 250ms-ийн дараа хайна (debounce)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json().catch(() => null)) as
          | { results?: SearchResult[] }
          | null;
        setResults(res.ok ? data?.results ?? [] : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function clear() {
    setQ("");
    setResults([]);
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Файл хайх…"
          className="w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 py-1.5 pl-8 pr-2 text-xs text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/40 focus:border-sidebar-foreground/30"
        />
      </div>

      {q.trim() && (
        <div className="mt-2 space-y-0.5">
          {loading && results.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-sidebar-foreground/40">
              Хайж байна…
            </p>
          ) : results.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-sidebar-foreground/40">
              Илэрц алга.
            </p>
          ) : (
            results.map((file) => (
              <Link
                key={file.id}
                href={`/dashboard/file?folderId=${file.projectId}&fileId=${file.id}`}
                onClick={clear}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{file.name}</span>
                  <span className="block truncate text-[10px] text-sidebar-foreground/40">
                    {file.project.name}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

function SidebarFile({
  file,
  projectId,
}: {
  file: ApiProjectFile;
  projectId: string;
}) {
  const Icon = FILE_TYPE_ICONS[getFileType(file)] ?? FileText;
  return (
    <li>
      <Link
        href={`/dashboard/file?folderId=${projectId}&fileId=${file.id}`}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{file.name}</span>
      </Link>
    </li>
  );
}

// ─── Дэд folder зангилаа (рекурсив) ───────────────────────────────────────────

function SidebarFolderNode({
  project,
  folder,
  color,
}: {
  project: ApiProject;
  folder: ApiFolder;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="group flex items-center gap-1 rounded-md hover:bg-sidebar-accent/50">
        <button
          onClick={() => setOpen((o) => !o)}
          className="p-1 text-sidebar-foreground/60"
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <Link
          href={`/dashboard/project?projectId=${project.id}&dir=${folder.id}`}
          className="flex flex-1 items-center gap-2 py-1 pr-2 text-xs"
        >
          <FolderIcon className="h-3 w-3 shrink-0" style={{ color }} />
          <span className="truncate">{folder.name}</span>
        </Link>
      </div>
      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-4 ml-2.5">
          <SidebarDirContents project={project} dir={folder.id} color={color} />
        </ul>
      )}
    </li>
  );
}

// Тухайн dir доторх дэд folder + файлууд (мод рекурсив байдлаар салаална)
function SidebarDirContents({
  project,
  dir,
  color,
}: {
  project: ApiProject;
  dir: string | null;
  color: string;
}) {
  const folders = (project.folders ?? []).filter(
    (f) => (f.parentId ?? null) === dir,
  );
  const files = (project.files ?? []).filter(
    (f) => (f.folderId ?? null) === dir,
  );

  if (folders.length === 0 && files.length === 0) {
    return (
      <li className="py-1 text-[11px] text-sidebar-foreground/40">Empty</li>
    );
  }

  return (
    <>
      {folders.map((f) => (
        <SidebarFolderNode key={f.id} project={project} folder={f} color={color} />
      ))}
      {files.map((file) => (
        <SidebarFile key={file.id} file={file} projectId={project.id} />
      ))}
    </>
  );
}

// ─── Project row (folder доторх нэг project) ───────────────────────────────────

function SidebarProject({
  project,
  color,
  active,
}: {
  project: ApiProject;
  color: string;
  active: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const open = active || manualOpen;
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
          className="p-1 text-sidebar-foreground/60"
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <Link
          href={`/dashboard/project?projectId=${project.id}`}
          className="flex flex-1 items-center gap-2 py-1 pr-2 text-xs"
        >
          <FolderIcon className="h-3 w-3" style={{ color }} />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40">
            {project._count?.files ?? files.length}
          </span>
        </Link>
      </div>

      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-4 ml-2.5">
          <SidebarDirContents project={project} dir={null} color={color} />
        </ul>
      )}
    </li>
  );
}

// ─── Folder section (6 тогтмол folder-ийн нэг) ────────────────────────────────

function SidebarFolderSection({
  folder,
  projects,
  activeKey,
  activeProjectId,
}: {
  folder: FolderDef;
  projects: ApiProject[];
  activeKey: string | null;
  activeProjectId: string | null;
}) {
  const items = projects.filter((p) => getProjectFolderKey(p) === folder.key);
  const active =
    activeKey === folder.key ||
    items.some((p) => p.id === activeProjectId);
  const [manualOpen, setManualOpen] = useState(false);
  const open = active || manualOpen;
  const Icon = folder.icon;

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
          href={`/dashboard/folder?key=${folder.key}`}
          className="flex flex-1 items-center gap-2 py-1.5 pr-2 text-sm"
        >
          <Icon className="h-3.5 w-3.5" style={{ color: folder.color }} />
          <span className="truncate">{folder.label}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40">
            {items.length}
          </span>
        </Link>
      </div>

      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-5 ml-3">
          {items.length === 0 ? (
            <li className="py-1 text-[11px] text-sidebar-foreground/40">Empty</li>
          ) : (
            items.map((project) => (
              <SidebarProject
                key={project.id}
                project={project}
                color={folder.color}
                active={project.id === activeProjectId}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ─── Sidebar nav (useSearchParams ашигладаг тул Suspense дотор) ───────────────

function SidebarNav() {
  const searchParams = useSearchParams();
  const { projects } = useProjectFolders();

  const activeKey = searchParams.get("key");
  const activeProjectId =
    searchParams.get("projectId") ?? searchParams.get("folderId");

  return (
    <ul className="mt-2 space-y-0.5">
      {FOLDERS.map((folder) => (
        <SidebarFolderSection
          key={folder.key}
          folder={folder}
          projects={projects}
          activeKey={activeKey}
          activeProjectId={activeProjectId}
        />
      ))}
    </ul>
  );
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function RightPanel() {
  const { projects } = useProjectFolders();
  const storage = useStorage();

  const totalFiles = projects.reduce(
    (acc, p) => acc + (p._count?.files ?? p.files?.length ?? 0),
    0,
  );

  // Storage — /api/storage-аас жинхэнэ ашиглалт
  const usedBytes = Number(storage?.usedBytes ?? 0);
  const quotaBytes = Number(storage?.quotaBytes ?? 0);
  const pct = quotaBytes > 0 ? Math.min((usedBytes / quotaBytes) * 100, 100) : 0;

  return (
    <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-border bg-card/40 p-5 xl:flex">
      {/* At a glance */}
      <div>
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
              {formatBytes(String(usedBytes))} / {formatBytes(String(quotaBytes))}
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-1.5" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pct.toFixed(pct < 10 ? 1 : 0)}% дүүрсэн
          </p>
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
  const { user, loading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

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
    <div className="grid h-screen grid-cols-[240px_1fr] overflow-hidden bg-background xl:grid-cols-[280px_1fr_300px]">
      {/* Sidebar */}
      <aside className="flex min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="p-5 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-card">
              <Image
                src="/logo1.png"
                alt="Terra Line Survey logo"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
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
          <SidebarSearch />

          <Link
            href="/dashboard/tasks"
            className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Даалгавар
          </Link>

          {user.role === "ADMIN" && (
            <Link
              href="/dashboard/admin"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Хэрэглэгчид
            </Link>
          )}

          <div className="mt-4 px-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            Folders
          </div>
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>
        </div>

        {/* User footer — дарвал профайл засна */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProfileOpen(true)}
              title="Профайл засах"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-sidebar-accent/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm">
                {(user.name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {user.name || user.email}
                </div>
                <div className="text-[10px] text-sidebar-foreground/50">
                  Signed in
                </div>
              </div>
            </button>
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

      <main className="min-h-0 overflow-y-auto">{children}</main>

      <RightPanel />

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
