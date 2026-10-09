"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "next-auth/react";
import {
  formatBytes,
  getFileType,
  useProjectFolder,
  useProjectFolders,
  useStorage,
} from "@/hooks/use-project-folders";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkspaceSkeleton } from "@/components/skeletons";
import { getFolder, getProjectFolderKey } from "@/lib/folders";
import { useCreateDocument } from "@/hooks/use-create-document";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
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
  Home,
  Loader2,
  Menu,
  Plus,
  X,
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
      <li className="py-1 text-[11px] text-sidebar-foreground/40">Хоосон</li>
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
  icon: VisibilityIcon = FolderIcon,
  active,
}: {
  project: ApiProject;
  color: string;
  icon?: LucideIcon;
  active: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const open = active || manualOpen;

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
          <VisibilityIcon className="h-3 w-3 shrink-0" style={{ color }} />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40">
            {project._count?.files ?? 0}
          </span>
        </Link>
      </div>

      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-4 ml-2.5">
          <SidebarProjectContents projectId={project.id} color={color} />
        </ul>
      )}
    </li>
  );
}

// Төслийн файлуудыг зөвхөн sidebar дээр нээх үед ачаална —
// жагсаалт (/api/projects) файл агуулахгүй тул хөнгөн.
function SidebarProjectContents({
  projectId,
  color,
}: {
  projectId: string;
  color: string;
}) {
  const { project, error } = useProjectFolder(projectId);

  if (error && !project) {
    return <li className="py-1 text-[11px] text-sidebar-foreground/40">{error}</li>;
  }
  if (!project) {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-3 w-3 shrink-0 bg-sidebar-accent" />
            <Skeleton
              className="h-2.5 bg-sidebar-accent"
              style={{ width: `${70 - i * 15}%` }}
            />
          </li>
        ))}
      </>
    );
  }
  return <SidebarDirContents project={project} dir={null} color={color} />;
}

// ─── Төслүүдийн жагсаалт ──────────────────────────────────────────────────────
// Өмнө нь Public/Shared/Private/Reference/Archive/Trash гэсэн 6 хандалтын
// ангилал навигацын гол хэсэг байсан. Хэрэглэгч "аль ангилалд байгаа вэ"
// биш "аль төсөл вэ" гэж боддог тул идэвхтэй төслүүдийг шууд жагсаана.
// Хандалтын төрөл нь төслийн хажууд жижиг icon-оор харагдана.

function SidebarProjects({ onNewProject }: { onNewProject: () => void }) {
  const searchParams = useSearchParams();
  const { projects, loading } = useProjectFolders();
  const activeProjectId =
    searchParams.get("projectId") ?? searchParams.get("folderId");

  const active = projects.filter((p) => {
    const key = getProjectFolderKey(p);
    return key !== "ARCHIVE" && key !== "TRASH";
  });

  return (
    <>
      <div className="mt-5 flex items-center px-2">
        <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
          Төслүүд
        </span>
        <button
          type="button"
          onClick={onNewProject}
          title="Шинэ төсөл / кодоор нэгдэх"
          className="ml-auto rounded p-0.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="mt-1 space-y-0.5">
        {loading && active.length === 0 ? (
          [0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-2 px-2 py-1.5">
              <Skeleton className="h-3 w-3 bg-sidebar-accent" />
              <Skeleton className="h-3 bg-sidebar-accent" style={{ width: `${70 - i * 15}%` }} />
            </li>
          ))
        ) : active.length === 0 ? (
          <li className="px-2 py-1 text-[11px] text-sidebar-foreground/40">
            Төсөл алга. + дарж үүсгэнэ үү.
          </li>
        ) : (
          active.map((project) => {
            const folder = getFolder(getProjectFolderKey(project));
            return (
              <SidebarProject
                key={project.id}
                project={project}
                color={folder?.color ?? "#0f766e"}
                icon={folder?.icon}
                active={project.id === activeProjectId}
              />
            );
          })
        )}
      </ul>
      <div className="mt-3 flex gap-1 px-1">
        {(["ARCHIVE", "TRASH"] as const).map((key) => {
          const folder = getFolder(key)!;
          const Icon = folder.icon;
          return (
            <Link
              key={key}
              href={`/dashboard/folder?key=${key}`}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Icon className="h-3 w-3" />
              {key === "ARCHIVE" ? "Архив" : "Хогийн сав"}
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function RightPanel() {
  const { projects } = useProjectFolders();
  const storage = useStorage();

  const totalFiles = projects.reduce(
    (acc, p) => acc + (p._count?.files ?? 0),
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
          Тойм
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">Төсөл</div>
            <div className="font-display text-2xl text-primary">
              {projects.length}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">Файл</div>
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
            <div className="text-sm font-medium">Хадгалах сан</div>
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

// ─── Sidebar-ийн агуулга (desktop-д байнга, утсанд drawer дотор) ──────────────

function SidebarBody({
  isAdmin,
  onNewProject,
}: {
  isAdmin: boolean;
  onNewProject: () => void;
}) {
  const { createDocument, creating } = useCreateDocument();
  const pathname = usePathname();

  const navItem = (href: string, label: string, Icon: LucideIcon) => (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
        pathname === href
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4">
      {/* Хамгийн их хийдэг үйлдэл — нэг товчоор шинэ баримт */}
      <button
        type="button"
        disabled={creating}
        onClick={() => void createDocument()}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-60"
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Шинэ баримт
      </button>

      <SidebarSearch />

      <div className="mt-3 space-y-0.5">
        {navItem("/dashboard", "Нүүр", Home)}
        {navItem("/dashboard/tasks", "Даалгавар", ClipboardList)}
        {isAdmin && navItem("/dashboard/admin", "Хэрэглэгчид", ShieldCheck)}
      </div>

      <Suspense fallback={null}>
        <SidebarProjects onNewProject={onNewProject} />
      </Suspense>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Утсан дээр: хуудас солигдоход цэсийг хаана
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    // Session cookie байгаа ч DB-д хэрэглэгч байхгүй (устгагдсан/хаагдсан)
    // тохиолдолд router.push("/login") хийвэл proxy буцаагаад dashboard руу
    // үсэргэж мөнхийн эргэлт үүснэ — тиймээс cookie-г нь цэвэрлэж гаргана.
    if (!loading && !user) void signOut({ callbackUrl: "/login" });
  }, [loading, user]);

  if (loading || !user) {
    return <WorkspaceSkeleton />;
  }

  const brand = (
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
        <div className="text-sm font-medium text-sidebar-foreground">Terra Line</div>
        <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
          Workspace
        </div>
      </div>
    </Link>
  );

  const userFooter = (
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
            <div className="truncate text-xs font-medium">{user.name || user.email}</div>
            <div className="text-[10px] text-sidebar-foreground/50">Профайл засах</div>
          </div>
        </button>
        <button
          onClick={async () => {
            await signOut({ callbackUrl: "/login" });
          }}
          title="Гарах"
          className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const sidebar = (
    <>
      <div className="flex items-center border-b border-sidebar-border p-5">
        {brand}
        <button
          type="button"
          className="ml-auto rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent md:hidden"
          onClick={() => setDrawerOpen(false)}
          title="Хаах"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <SidebarBody
        isAdmin={user.role === "ADMIN"}
        onNewProject={() => {
          setDrawerOpen(false);
          setNewProjectOpen(true);
        }}
      />
      {userFooter}
    </>
  );

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden bg-background md:grid-cols-[240px_1fr] md:grid-rows-1 xl:grid-cols-[280px_1fr_300px]">
      {/* Утасны дээд мөр — цэс нээх товч */}
      <header className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5 text-sidebar-foreground md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-1.5 hover:bg-sidebar-accent"
          title="Цэс"
        >
          <Menu className="h-5 w-5" />
        </button>
        {brand}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        {sidebar}
      </aside>

      {/* Утасны drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-h-0 overflow-y-auto">{children}</main>

      <RightPanel />

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
}
