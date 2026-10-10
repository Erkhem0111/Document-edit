"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, Folder as FolderIcon } from "lucide-react";
import { useProjectFolder, useProjectFolders } from "@/hooks/use-project-folders";
import {
  DIRECT_WORKSPACE_KEYS,
  FOLDERS,
  getProjectFolderKey,
  type FolderDef,
} from "@/lib/folders";
import { FileTypeIcon } from "@/components/file/file-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ApiFolder, ApiProject, ApiProjectFile } from "@/types/domain";

// ─── Зүүн талын folder мод ────────────────────────────────────────────────────
// Дүрэм:
//  • Мөр дээр дарвал тэр хуудас руу орно. Дотроо зүйлтэй бол мөн доошоо задарна.
//  • Хоосон бол сум (chevron) ч, "Хоосон" мөр ч гарахгүй — зүгээр л тэр хуудас.
//  • Одоо нээлттэй байгаа газар хүртэлх зам автоматаар задарсан байна.
//  • Private/Public/Reference-д нэг л ажлын орчин байвал "Private › Private"
//    гэж давхарлахгүй — доторх зүйлсийг шууд folder-ын доор харуулна.

// Нэг хавтсанд хэт олон файл байвал sidebar-ийг дүүргэхгүй
const MAX_FILES_IN_TREE = 30;

type Active = {
  key: string | null;
  projectId: string | null;
  dir: string | null;
  fileId: string | null;
};

function useActiveLocation(): Active {
  const pathname = usePathname();
  const sp = useSearchParams();
  return {
    key: pathname === "/dashboard/folder" ? sp.get("key") : null,
    projectId:
      pathname === "/dashboard/project"
        ? sp.get("projectId")
        : pathname === "/dashboard/file"
          ? sp.get("folderId")
          : null,
    dir: pathname === "/dashboard/project" ? sp.get("dir") : null,
    fileId: pathname === "/dashboard/file" ? sp.get("fileId") : null,
  };
}

function projectHasContent(project: ApiProject) {
  return (project.folders?.length ?? 0) > 0 || (project._count?.files ?? 0) > 0;
}

// Задрах/хураах төлөв: хэрэглэгч гараар өөрчлөөгүй бол идэвхтэй зам дээр
// байгаа эсэхээр шийднэ.
function useOpenState(onPath: boolean) {
  const [manual, setManual] = useState<boolean | null>(null);
  return {
    open: manual ?? onPath,
    expand: () => setManual(true),
    toggle: () => setManual((m) => !(m ?? onPath)),
  };
}

function TreeRow({
  href,
  label,
  icon,
  active,
  hasChildren,
  open,
  onToggle,
  onNavigate,
  count,
  badge,
  strong = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  hasChildren: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  count?: number;
  badge?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center rounded-md transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? "Хураах" : "Задлах"}
          className="flex h-6 w-5 shrink-0 items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <Link
        href={href}
        onClick={() => {
          if (hasChildren) onNavigate();
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 py-1 pr-2",
          strong ? "text-[13px]" : "text-xs",
          active && "font-medium",
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
        {badge && (
          <span className="shrink-0 rounded bg-sidebar-accent px-1 text-[9px] uppercase tracking-wide text-sidebar-foreground/60">
            {badge}
          </span>
        )}
        {count !== undefined && count > 0 && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-sidebar-foreground/40">
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}

function Children({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-2.5 space-y-px border-l border-sidebar-border/60 pl-1.5">{children}</ul>
  );
}

// ─── Folder (хандалтын төрөл) ─────────────────────────────────────────────────

function RoleNode({
  folder,
  projects,
  active,
}: {
  folder: FolderDef;
  projects: ApiProject[];
  active: Active;
}) {
  const items = projects.filter((p) => getProjectFolderKey(p) === folder.key);
  // Нэг л ажлын орчинтой бол түүний агуулгыг шууд энд задлана
  const direct = DIRECT_WORKSPACE_KEYS.includes(folder.key) && items.length === 1;
  const workspace = direct ? items[0] : null;

  const hasChildren = workspace ? projectHasContent(workspace) : items.length > 0;
  const onPath =
    active.key === folder.key || items.some((p) => p.id === active.projectId);
  const { open, expand, toggle } = useOpenState(onPath);
  const isActive =
    active.key === folder.key ||
    (workspace !== null &&
      active.projectId === workspace.id &&
      !active.dir &&
      !active.fileId);
  const Icon = folder.icon;
  const fileCount = items.reduce((sum, p) => sum + (p._count?.files ?? 0), 0);

  return (
    <li>
      <TreeRow
        href={
          workspace
            ? `/dashboard/project?projectId=${workspace.id}`
            : `/dashboard/folder?key=${folder.key}`
        }
        label={folder.label}
        icon={<Icon className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color }} />}
        active={isActive}
        hasChildren={hasChildren}
        open={open}
        onToggle={toggle}
        onNavigate={expand}
        count={fileCount}
        strong
      />
      {open && hasChildren && (
        <Children>
          {workspace ? (
            <ProjectContents projectId={workspace.id} color={folder.color} active={active} />
          ) : (
            items.map((project) => (
              <ProjectNode
                key={project.id}
                project={project}
                color={folder.color}
                active={active}
              />
            ))
          )}
        </Children>
      )}
    </li>
  );
}

// ─── Төсөл ────────────────────────────────────────────────────────────────────

function ProjectNode({
  project,
  color,
  active,
}: {
  project: ApiProject;
  color: string;
  active: Active;
}) {
  const hasChildren = projectHasContent(project);
  const onPath = active.projectId === project.id;
  const { open, expand, toggle } = useOpenState(onPath);
  return (
    <li>
      <TreeRow
        href={`/dashboard/project?projectId=${project.id}`}
        label={project.name}
        icon={<FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color }} />}
        active={onPath && !active.dir && !active.fileId}
        hasChildren={hasChildren}
        open={open}
        onToggle={toggle}
        onNavigate={expand}
        count={project._count?.files}
        badge={project.isArchived ? "архив" : undefined}
      />
      {open && hasChildren && (
        <Children>
          <ProjectContents projectId={project.id} color={color} active={active} />
        </Children>
      )}
    </li>
  );
}

// Төслийн доторх хавтас/файлууд — зөвхөн задрах үед ачаална
function ProjectContents({
  projectId,
  color,
  active,
}: {
  projectId: string;
  color: string;
  active: Active;
}) {
  const { project, error } = useProjectFolder(projectId);

  if (!project) {
    if (error) {
      return <li className="px-2 py-1 text-[11px] text-sidebar-foreground/40">{error}</li>;
    }
    return (
      <>
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-2 px-2 py-1">
            <Skeleton className="h-3 w-3 bg-sidebar-accent" />
            <Skeleton className="h-2.5 bg-sidebar-accent" style={{ width: `${65 - i * 15}%` }} />
          </li>
        ))}
      </>
    );
  }

  const folders = project.folders ?? [];
  const files = project.files ?? [];

  // Идэвхтэй файл/хавтас хүртэлх хавтаснуудыг задлах
  const activeHere = active.projectId === project.id;
  const activeDir = activeHere
    ? (active.dir ?? files.find((f) => f.id === active.fileId)?.folderId ?? null)
    : null;
  const pathIds = new Set<string>();
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (let cur = activeDir ? byId.get(activeDir) : undefined; cur; ) {
    pathIds.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }

  return (
    <DirContents
      project={project}
      folders={folders}
      files={files}
      dir={null}
      color={color}
      active={active}
      pathIds={pathIds}
    />
  );
}

function DirContents({
  project,
  folders,
  files,
  dir,
  color,
  active,
  pathIds,
}: {
  project: ApiProject;
  folders: ApiFolder[];
  files: ApiProjectFile[];
  dir: string | null;
  color: string;
  active: Active;
  pathIds: Set<string>;
}) {
  const subFolders = folders
    .filter((f) => (f.parentId ?? null) === dir)
    .sort((a, b) => a.name.localeCompare(b.name));
  const dirFiles = files.filter((f) => (f.folderId ?? null) === dir);
  const shownFiles = dirFiles.slice(0, MAX_FILES_IN_TREE);
  const hidden = dirFiles.length - shownFiles.length;

  return (
    <>
      {subFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          project={project}
          folder={folder}
          folders={folders}
          files={files}
          color={color}
          active={active}
          pathIds={pathIds}
        />
      ))}
      {shownFiles.map((file) => (
        <li key={file.id}>
          <TreeRow
            href={`/dashboard/file?folderId=${project.id}&fileId=${file.id}`}
            label={file.name}
            icon={<FileTypeIcon name={file.name} mimeType={file.mimeType} size="sm" />}
            active={active.fileId === file.id}
            hasChildren={false}
            open={false}
            onToggle={() => {}}
            onNavigate={() => {}}
          />
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <Link
            href={
              dir
                ? `/dashboard/project?projectId=${project.id}&dir=${dir}`
                : `/dashboard/project?projectId=${project.id}`
            }
            className="block py-1 pl-7 text-[11px] text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            + {hidden} файл
          </Link>
        </li>
      )}
    </>
  );
}

function FolderNode({
  project,
  folder,
  folders,
  files,
  color,
  active,
  pathIds,
}: {
  project: ApiProject;
  folder: ApiFolder;
  folders: ApiFolder[];
  files: ApiProjectFile[];
  color: string;
  active: Active;
  pathIds: Set<string>;
}) {
  const hasChildren =
    folders.some((f) => f.parentId === folder.id) ||
    files.some((f) => f.folderId === folder.id);
  const { open, expand, toggle } = useOpenState(pathIds.has(folder.id));
  const count = files.filter((f) => f.folderId === folder.id).length;
  return (
    <li>
      <TreeRow
        href={`/dashboard/project?projectId=${project.id}&dir=${folder.id}`}
        label={folder.name}
        icon={<FolderIcon className="h-3.5 w-3.5 shrink-0" style={{ color }} />}
        active={active.projectId === project.id && active.dir === folder.id}
        hasChildren={hasChildren}
        open={open}
        onToggle={toggle}
        onNavigate={expand}
        count={count}
      />
      {open && hasChildren && (
        <Children>
          <DirContents
            project={project}
            folders={folders}
            files={files}
            dir={folder.id}
            color={color}
            active={active}
            pathIds={pathIds}
          />
        </Children>
      )}
    </li>
  );
}

// ─── Бүх мод ──────────────────────────────────────────────────────────────────

export function SidebarTree() {
  const { projects, loading } = useProjectFolders();
  const active = useActiveLocation();

  if (loading && projects.length === 0) {
    return (
      <ul className="space-y-1.5 px-2 py-1">
        {FOLDERS.map((f, i) => (
          <li key={f.key} className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 bg-sidebar-accent" />
            <Skeleton className="h-3 bg-sidebar-accent" style={{ width: `${60 - (i % 3) * 10}%` }} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-px">
      {FOLDERS.map((folder) => (
        <RoleNode key={folder.key} folder={folder} projects={projects} active={active} />
      ))}
    </ul>
  );
}
