"use client";
import { Suspense, useRef, useState } from "react";
import {
  getFilePermission,
  getFileSize,
  getFileType,
  useProjectFolder,
} from "@/hooks/use-project-folders";
import { getFolder, getProjectFolderKey } from "@/lib/folders";
import { useAuth } from "@/hooks/use-auth";
import { ProjectActions } from "@/components/project/project-actions";
import { FolderActions } from "@/components/project/folder-actions";
import { InviteButton } from "@/components/project/invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  FilePlus,
  FolderPlus,
  FileText,
  HardDrive,
  Folder as FolderIcon,
  Map as MapIcon,
  FileBarChart,
  Image as ImageIcon,
  ScanLine,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ApiFolder } from "@/types/domain";

const FILE_ICONS = {
  doc: FileText,
  map: MapIcon,
  report: FileBarChart,
  survey: ScanLine,
  image: ImageIcon,
  file: FileText,
} as const;

// Одоогийн dir хүртэлх замыг (breadcrumb) folder жагсаалтаас барина
function buildBreadcrumb(folders: ApiFolder[], dir: string | null): ApiFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: ApiFolder[] = [];
  let cur = dir ? byId.get(dir) : undefined;
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

function ProjectFilesPage({
  projectId,
  dir,
}: {
  projectId: string;
  dir: string | null;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { project, loading, error, refresh } = useProjectFolder(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  if (authLoading || loading) return <ProjectEmptyState message="Loading project..." />;
  if (!user) return <ProjectEmptyState message="Sign in required." />;
  if (error || !project) {
    return <ProjectEmptyState message={error ?? "Project not found."} />;
  }

  const allFolders = project.folders ?? [];
  const allFiles = project.files ?? [];

  // Одоогийн dir доторх дэд folder + файлууд
  const subFolders = allFolders
    .filter((f) => (f.parentId ?? null) === dir)
    .sort((a, b) => a.name.localeCompare(b.name));
  const dirFiles = allFiles
    .filter((f) => (f.folderId ?? null) === dir)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const isEmpty = subFolders.length === 0 && dirFiles.length === 0;

  const breadcrumb = buildBreadcrumb(allFolders, dir);
  const roleFolder = getFolder(getProjectFolderKey(project));
  const color = roleFolder?.color ?? "#0f766e";
  const myRole = project.members?.find((m) => m.user?.id === user.id)?.role;
  const isOwner = user.role === "ADMIN" || myRole === "OWNER";
  const isReference = roleFolder?.key === "REFERENCE";
  const isTrash = roleFolder?.key === "TRASH";
  const canManage = isOwner;
  const canUpload = Boolean(myRole);
  const showFileActions = isReference || Boolean(myRole);

  function itemCount(folderId: string): number {
    return (
      allFolders.filter((f) => f.parentId === folderId).length +
      allFiles.filter((f) => (f.folderId ?? null) === folderId).length
    );
  }

  // Одоогийн dir руу файл(ууд) upload хийнэ
  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    let ok = 0;
    try {
      for (const selected of files) {
        const formData = new FormData();
        formData.append("file", selected);
        if (dir) formData.append("folderId", dir);
        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { message?: string }
            | null;
          toast.error(`"${selected.name}": ${body?.message ?? "upload failed"}`);
          continue;
        }
        ok += 1;
      }
      if (ok > 0) {
        toast.success(`${ok} файл орууллаа`);
        await refresh();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createDocument() {
    const name = docName.trim();
    if (!name) {
      toast.error("Баримтын нэрээ оруулна уу");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, folderId: dir }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Could not create document.");
      }
      const data = (await response.json()) as { file: { id: string } };
      router.push(`/dashboard/file?folderId=${projectId}&fileId=${data.file.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create document.");
      setCreating(false);
    }
  }

  async function createFolder() {
    const name = folderName.trim();
    if (!name) {
      toast.error("Folder-ийн нэрээ оруулна уу");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: dir }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Could not create folder.");
      }
      toast.success(`"${name}" folder үүсгэлээ`);
      setFolderDialogOpen(false);
      setFolderName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create folder.");
    } finally {
      setCreating(false);
    }
  }

  // Trash доторх файлыг DB-ээс бүр мөсөн устгана (version, comment, activity нь Cascade-аар устна)
  async function deleteFile(file: { id: string; name: string }) {
    const ok = window.confirm(
      `"${file.name}" файлыг DB-ээс бүр мөсөн устгах уу?`,
    );
    if (!ok) return;

    const response = await fetch(`/api/files/${file.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      toast.error(body?.message ?? "Файл устгаж чадсангүй.");
      return;
    }
    toast.success(`"${file.name}" бүр мөсөн устгагдлаа.`);
    await refresh();
  }

  function dirHref(folderId: string | null) {
    return folderId
      ? `/dashboard/project?projectId=${projectId}&dir=${folderId}`
      : `/dashboard/project?projectId=${projectId}`;
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    if (!canUpload) return;
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length) void uploadFiles(dropped);
  }
  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    if (canUpload && !dragActive) setDragActive(true);
  }
  function onDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
  }

  const busy = uploading || creating;

  return (
    <div className="px-10 py-10">
      <Link
        href={`/dashboard/folder?key=${roleFolder?.key ?? "PRIVATE"}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> {roleFolder?.label ?? "Workspace"}
      </Link>

      <div className="mt-4 flex items-end justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {roleFolder?.label ?? "Project"} workspace
            </p>
          </div>
          {/* Breadcrumb: project root / folder / folder */}
          <h1 className="mt-2 flex flex-wrap items-center gap-1.5 font-display text-3xl text-primary">
            <Link href={dirHref(null)} className="hover:underline">
              {project.name}
            </Link>
            {breadcrumb.map((f) => (
              <span key={f.id} className="flex items-center gap-1.5">
                <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                <Link href={dirHref(f.id)} className="hover:underline">
                  {f.name}
                </Link>
              </span>
            ))}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showFileActions && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
              />
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setFolderName("");
                  setFolderDialogOpen(true);
                }}
              >
                <FolderPlus className="mr-2 h-4 w-4" /> Folder
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDocName("");
                  setDocDialogOpen(true);
                }}
              >
                <FilePlus className="mr-2 h-4 w-4" /> Document
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            </>
          )}
          {isOwner && roleFolder?.key === "SHARED" && (
            <InviteButton projectId={project.id} />
          )}
          {canManage && (
            <ProjectActions
              project={project}
              onChanged={refresh}
            />
          )}
        </div>
      </div>

      <div
        className={`relative mt-8 overflow-hidden rounded-2xl border bg-card shadow-soft transition ${
          dragActive ? "border-teal ring-2 ring-teal/40" : "border-border"
        }`}
        onDragOver={canUpload ? onDragOver : undefined}
        onDragLeave={canUpload ? onDragLeave : undefined}
        onDrop={canUpload ? onDrop : undefined}
      >
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-card/90 text-teal">
            <Upload className="h-7 w-7" />
            <p className="text-sm font-medium">Файлаа энд тавь</p>
          </div>
        )}

        <div className="grid grid-cols-[1fr_170px_120px_40px] border-b border-border bg-muted/40 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Name</span>
          <span>Created</span>
          <span>Size</span>
          <span />
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-teal">
              <FolderIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">Энэ folder хоосон байна</p>
            {canUpload ? (
              <p className="text-xs text-muted-foreground">
                Folder эсвэл баримт үүсгэ, файлаа чирж оруул.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Read-only — зөвхөн upload хийсэн файлуудыг харна.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Folder-ууд эхэлж */}
            {subFolders.map((f) => (
              <div
                key={f.id}
                className="group grid grid-cols-[1fr_170px_120px_40px] items-center border-b border-border/60 px-5 py-3 text-sm transition hover:bg-accent/40 last:border-b-0"
              >
                <Link
                  href={dirHref(f.id)}
                  className="flex items-center gap-3 min-w-0"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
                      color,
                    }}
                  >
                    <FolderIcon className="h-4 w-4" />
                  </div>
                  <span className="truncate font-medium text-foreground">{f.name}</span>
                </Link>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(f.createdAt), "MMM d, yyyy HH:mm")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {itemCount(f.id)} зүйл
                </span>
                <span className="flex justify-end">
                  {isOwner && (
                    <FolderActions
                      folder={f}
                      onChanged={refresh}
                    />
                  )}
                </span>
              </div>
            ))}

            {/* Дараа нь файлууд */}
            {dirFiles.map((file) => {
              const Icon = FILE_ICONS[getFileType(file)] ?? FileText;
              const size = file.versions?.length ? getFileSize(file) : "Document";
              return (
                <Link
                  key={file.id}
                  href={`/dashboard/file?folderId=${project.id}&fileId=${file.id}`}
                  className="grid grid-cols-[1fr_170px_120px_40px] items-center border-b border-border/60 px-5 py-3 text-sm transition hover:bg-accent/40 last:border-b-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-teal">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="truncate font-medium text-foreground">
                      {file.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(file.createdAt), "MMM d, yyyy HH:mm")}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HardDrive className="h-3 w-3 shrink-0" /> {size}
                  </span>
                  <span className="flex justify-end text-[10px] text-muted-foreground/70">
                    {isTrash && isOwner ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Delete permanently"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void deleteFile(file);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      getFilePermission(file, user.id, myRole).charAt(0)
                    )}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </div>

      {/* New folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              New folder
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="foldername">Folder-ийн нэр</Label>
            <Input
              id="foldername"
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createFolder();
              }}
              placeholder="Жишээ: Зураг төсөл"
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={creating}
              onClick={createFolder}
            >
              <FolderPlus className="mr-2 h-4 w-4" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New document dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              New document
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="docname">Баримтын нэр</Label>
            <Input
              id="docname"
              autoFocus
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createDocument();
              }}
              placeholder="Жишээ: Хурлын тэмдэглэл"
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={creating}
              onClick={createDocument}
            >
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FilePlus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectEmptyState({ message }: { message: string }) {
  return (
    <div className="p-10">
      <p className="text-muted-foreground">{message}</p>
      <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
        Back to workspace
      </Link>
    </div>
  );
}

export default function DashboardProjectPage() {
  return (
    <Suspense fallback={<ProjectEmptyState message="Loading project..." />}>
      <ProjectPageContent />
    </Suspense>
  );
}

function ProjectPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const dir = searchParams.get("dir");

  if (!projectId) return <ProjectEmptyState message="Project not found." />;

  return <ProjectFilesPage projectId={projectId} dir={dir} />;
}
