"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { mn } from "date-fns/locale";
import { toast } from "sonner";
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  Loader2,
  MapPin,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import {
  getFileSize,
  notifyProjectsChanged,
  useProjectFolder,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import { DIRECT_WORKSPACE_KEYS, getFolder, getProjectFolderKey } from "@/lib/folders";
import { useAuth } from "@/hooks/use-auth";
import { ProjectActions } from "@/components/project/project-actions";
import { FolderActions } from "@/components/project/folder-actions";
import { MoveFileDialog } from "@/components/project/move-file-dialog";
import { ShareDialog } from "@/components/file/share-dialog";
import { JobStrip } from "@/components/jobs/job-strip";
import { isCoordinateFileName } from "@/lib/coordinates";
import { FileTypeIcon } from "@/components/file/file-type-icon";
import { PageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiFolder, ApiProjectFile } from "@/types/domain";

// ─── Folder-ын дотор (файлын жагсаалт) ───────────────────────────────────────
// Нягт, нарийн жагсаалт: дээр нь хавтаснууд, доор нь файлууд. Үүсгэх үйлдэл
// бүгд зүүн талын "＋ Шинэ"-д — энд давхар товч байхгүй. Файлаа шууд энд
// чирж оруулж болно. Баруун дээд буланд — хэн хандаж байгаа, хуваалцах.

const AVATAR_COLORS = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0369a1"];

function avatarColor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function shortDate(value: string) {
  const date = new Date(value);
  // Сүүлийн 7 хоногийнх бол "2 цагийн өмнө", эс бол огноо
  return Date.now() - +date < 7 * 24 * 3600 * 1000
    ? formatDistanceToNowStrict(date, { addSuffix: true, locale: mn })
    : format(date, "yyyy.MM.dd");
}

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

const FILE_PAGE_SIZE = 200;

function ProjectFilesPage({ projectId, dir }: { projectId: string; dir: string | null }) {
  const { user, loading: authLoading } = useAuth();
  const { project, loading, error, refresh } = useProjectFolder(projectId);
  const { projects } = useProjectFolders();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  type Named = { id: string; name: string };
  const [moving, setMoving] = useState<{ files: Named[]; folders: Named[] } | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Олон мянган файлтай хавтсанд бүгдийг нэг дор зурахгүй — эхний хэсгийг л
  const dirKey = `${projectId}:${dir ?? ""}`;
  const [shown, setShown] = useState({ key: dirKey, limit: FILE_PAGE_SIZE });
  const fileLimit = shown.key === dirKey ? shown.limit : FILE_PAGE_SIZE;
  // Олон файл сонгох — хавтас солигдоход сонголт цэвэрлэгдэнэ
  const [picked, setPicked] = useState<{ key: string; ids: Set<string>; last: number | null }>({
    key: dirKey,
    ids: new Set(),
    last: null,
  });
  const selected = picked.key === dirKey ? picked.ids : new Set<string>();
  const lastPicked = picked.key === dirKey ? picked.last : null;

  if (authLoading || loading) return <PageSkeleton />;
  if (!user) return <EmptyState message="Нэвтрэх шаардлагатай." />;
  if (error || !project) return <EmptyState message={error ?? "Олдсонгүй."} />;

  const allFolders = project.folders ?? [];
  const allFiles = project.files ?? [];
  const subFolders = allFolders
    .filter((f) => (f.parentId ?? null) === dir)
    .sort((a, b) => a.name.localeCompare(b.name));
  const dirFiles = allFiles
    .filter((f) => (f.folderId ?? null) === dir)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  const roleKey = getProjectFolderKey(project);
  const role = getFolder(roleKey);
  const color = role?.color ?? "#0f766e";
  const RoleIcon = role?.icon ?? FolderIcon;
  // Private/Public/Reference-д нэг л ажлын орчин байвал "Private › Private" гэж
  // давхарлахгүй — role нь өөрөө үндэс болно (sidebar-тай ижил дүрэм)
  const sameRole = projects.filter((p) => getProjectFolderKey(p) === roleKey);
  const flattened = DIRECT_WORKSPACE_KEYS.includes(roleKey) && sameRole.length <= 1;

  const myRole = project.members?.find((m) => m.user?.id === user.id)?.role;
  const isOwner = user.role === "ADMIN" || myRole === "OWNER";
  const isTrash = roleKey === "TRASH";
  const isReference = roleKey === "REFERENCE";
  const canUpload = !isTrash && (isOwner || (myRole === "EDITOR" && !isReference));
  const canShare = roleKey !== "PRIVATE" && !isTrash;
  const members = project.members ?? [];
  const breadcrumb = buildBreadcrumb(allFolders, dir);

  function dirHref(folderId: string | null) {
    return folderId
      ? `/dashboard/project?projectId=${projectId}&dir=${folderId}`
      : `/dashboard/project?projectId=${projectId}`;
  }

  function itemCount(folderId: string) {
    return (
      allFolders.filter((f) => f.parentId === folderId).length +
      allFiles.filter((f) => f.folderId === folderId).length
    );
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    let ok = 0;
    try {
      for (const selected of files) {
        const form = new FormData();
        form.append("file", selected);
        if (dir) form.append("folderId", dir);
        const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          toast.error(`"${selected.name}": ${body?.message ?? "оруулж чадсангүй"}`);
          continue;
        }
        ok += 1;
      }
      if (ok > 0) {
        toast.success(ok === 1 ? "Файл орлоо" : `${ok} файл орлоо`);
        notifyProjectsChanged();
      }
    } finally {
      setUploading(false);
    }
  }

  // Хогийн саванд байгаа файлыг бүр мөсөн устгана
  async function deleteFile(file: { id: string; name: string }) {
    if (!window.confirm(`"${file.name}" файлыг бүр мөсөн устгах уу? Буцаах боломжгүй.`)) return;
    setDeletingFileId(file.id);
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(body?.message ?? "Устгаж чадсангүй.");
        return;
      }
      toast.success("Устгагдлаа");
      notifyProjectsChanged();
    } finally {
      setDeletingFileId(null);
    }
  }

  const shownFiles = dirFiles.slice(0, fileLimit);
  // Хавтас, файл нэг жагсаалтад — хавтас нь эхэнд. Сонголтын түлхүүр: "d:" / "f:"
  const rows: ({ kind: "folder"; key: string; folder: ApiFolder } | { kind: "file"; key: string; file: ApiProjectFile })[] = [
    ...subFolders.map((folder) => ({ kind: "folder" as const, key: `d:${folder.id}`, folder })),
    ...shownFiles.map((file) => ({ kind: "file" as const, key: `f:${file.id}`, file })),
  ];
  const canSelect = isOwner;
  const selectedFolders = subFolders.filter((f) => selected.has(`d:${f.id}`));
  const selectedFiles = dirFiles.filter((f) => selected.has(`f:${f.id}`));
  const selectedCount = selectedFolders.length + selectedFiles.length;
  const allShownSelected = rows.length > 0 && rows.every((r) => selected.has(r.key));

  function clearSelection() {
    setPicked({ key: dirKey, ids: new Set(), last: null });
  }

  // Shift дарж байвал өмнө сонгосноос энэ хүртэлх бүгдийг сонгоно (зургийн апп шиг)
  function toggleRow(index: number, shift: boolean) {
    const ids = new Set(selected);
    const key = rows[index].key;
    const turnOn = !ids.has(key);
    if (shift && lastPicked !== null && lastPicked < rows.length) {
      const [from, to] = lastPicked < index ? [lastPicked, index] : [index, lastPicked];
      for (let i = from; i <= to; i++) {
        if (turnOn) ids.add(rows[i].key);
        else ids.delete(rows[i].key);
      }
    } else if (turnOn) ids.add(key);
    else ids.delete(key);
    setPicked({ key: dirKey, ids, last: index });
  }

  function toggleAll() {
    setPicked({
      key: dirKey,
      ids: allShownSelected ? new Set() : new Set(rows.map((r) => r.key)),
      last: null,
    });
  }

  async function deleteSelected() {
    if (selectedCount === 0) return;
    const parts = [
      selectedFiles.length ? `${selectedFiles.length} файлыг бүр мөсөн устгана (буцаах боломжгүй)` : "",
      selectedFolders.length
        ? `${selectedFolders.length} хавтсыг устгана — доторх файлууд нь энд шилжиж үлдэнэ`
        : "",
    ].filter(Boolean);
    if (!window.confirm(`${parts.join(".\n")}.\n\nҮргэлжлүүлэх үү?`)) return;
    setBulkDeleting(true);
    try {
      let folderErrors = 0;
      for (const folder of selectedFolders) {
        const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
        // Эцэг хавтас нь түрүүлж устсан бол 404 — аль хэдийн устсан гэсэн үг
        if (!res.ok && res.status !== 404) folderErrors += 1;
      }
      let deleted = 0;
      let skipped = 0;
      if (selectedFiles.length > 0) {
        const res = await fetch("/api/files/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: selectedFiles.map((f) => f.id) }),
        });
        const body = (await res.json().catch(() => null)) as
          | { deleted?: number; skipped?: number; message?: string }
          | null;
        if (!res.ok) toast.error(body?.message ?? "Файлуудыг устгаж чадсангүй.");
        deleted = body?.deleted ?? 0;
        skipped = body?.skipped ?? 0;
      }
      const done = selectedFolders.length - folderErrors + deleted;
      if (done > 0) toast.success(`${done} зүйл устгагдлаа`);
      if (folderErrors + skipped > 0) toast.error(`${folderErrors + skipped} зүйлийг устгах эрхгүй байлаа`);
      clearSelection();
      notifyProjectsChanged();
      await refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

  const dropProps = canUpload
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          if (!dragActive) setDragActive(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          // Хүүхэд элемент дээгүүр явахад анивчихгүй
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragActive(false);
          void uploadFiles(Array.from(e.dataTransfer.files));
        },
      }
    : {};

  return (
    <div className="relative flex min-h-full flex-col px-4 py-5 md:px-8" {...dropProps}>
      {/* ── Толгой: зам + хандалт ── */}
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex min-w-0 basis-full flex-wrap items-center gap-1 text-base sm:basis-0 sm:flex-1 md:text-xl">
          <Link
            href={flattened ? dirHref(null) : `/dashboard/folder?key=${roleKey}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-muted",
              flattened && breadcrumb.length === 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <RoleIcon className="h-4 w-4" style={{ color }} />
            {role?.label}
          </Link>
          {!flattened && (
            <Crumb href={dirHref(null)} label={project.name} last={breadcrumb.length === 0} />
          )}
          {breadcrumb.map((f, i) => (
            <Crumb key={f.id} href={dirHref(f.id)} label={f.name} last={i === breadcrumb.length - 1} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canShare && members.length > 0 && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="hidden items-center sm:flex"
              title={members.map((m) => m.user?.nickname || m.user?.email).join(", ")}
            >
              {members.slice(0, 4).map((m, i) => {
                const name = m.user?.nickname || m.user?.email || "?";
                return (
                  <span
                    key={m.user?.id ?? i}
                    className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-[11px] font-semibold text-white first:ml-0"
                    style={{ backgroundColor: avatarColor(name) }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                );
              })}
              {members.length > 4 && (
                <span className="-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                  +{members.length - 4}
                </span>
              )}
            </button>
          )}
          {canShare && (
            <Button
              size="sm"
              className="rounded-full bg-primary text-primary-foreground"
              onClick={() => setShareOpen(true)}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Хуваалцах
            </Button>
          )}
          {isOwner && <ProjectActions project={project} onChanged={refresh} />}
        </div>
      </div>

      {/* ── Ажлын мэдээлэл (зөвхөн ажил болсон төсөл дээр, нимгэн мөр) ── */}
      {!isTrash && (
        <JobStrip
          project={project}
          canEdit={isOwner || myRole === "EDITOR"}
          canRemove={isOwner}
          onChanged={refresh}
        />
      )}

      {/* ── Хавтас, файлууд — нэг жагсаалт ── */}
      {rows.length > 0 && (
        <section className="mt-5">
          <div className="text-sm">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground sm:grid-cols-[1fr_80px_auto] md:grid-cols-[1fr_140px_130px_80px_auto]">
              <span className="flex items-center gap-2.5">
                {canSelect && (
                  <input
                    type="checkbox"
                    aria-label="Бүгдийг сонгох"
                    title="Бүгдийг сонгох"
                    checked={allShownSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selected.size > 0 && !allShownSelected;
                    }}
                    onChange={toggleAll}
                    className="size-4 cursor-pointer accent-teal"
                  />
                )}
                Нэр
              </span>
              <span className="hidden md:block">Эзэмшигч</span>
              <span className="hidden md:block">Өөрчилсөн</span>
              <span className="hidden text-right sm:block">Хэмжээ</span>
              <span className="w-7" />
            </div>
            {rows.map((row, index) => {
              const selection = canSelect
                ? {
                    checked: selected.has(row.key),
                    active: selected.size > 0,
                    onToggle: (shift: boolean) => toggleRow(index, shift),
                  }
                : undefined;
              if (row.kind === "folder") {
                return (
                  <FolderRow
                    key={row.key}
                    folder={row.folder}
                    href={dirHref(row.folder.id)}
                    color={color}
                    count={itemCount(row.folder.id)}
                    selection={selection}
                    actions={isOwner ? <FolderActions folder={row.folder} onChanged={refresh} /> : null}
                  />
                );
              }
              const file = row.file;
              return (
                <FileRow
                  key={row.key}
                  file={file}
                  projectId={project.id}
                  meId={user.id}
                  selection={selection}
                  actions={
                    isTrash && isOwner ? (
                      <IconAction
                        title="Бүр мөсөн устгах"
                        destructive
                        busy={deletingFileId === file.id}
                        onClick={() => void deleteFile(file)}
                        icon={Trash2}
                      />
                    ) : isOwner ? (
                      <IconAction
                        title="Зөөх"
                        onClick={() => setMoving({ files: [{ id: file.id, name: file.name }], folders: [] })}
                        icon={FolderInput}
                      />
                    ) : null
                  }
                />
              );
            })}
            {dirFiles.length > fileLimit && (
              <button
                type="button"
                onClick={() => setShown({ key: dirKey, limit: fileLimit + FILE_PAGE_SIZE })}
                className="mt-1 w-full rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                Цааш харуулах ({dirFiles.length - fileLimit} файл үлдсэн)
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Хоосон ── */}
      {subFolders.length === 0 && dirFiles.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-sm text-foreground">Энд одоохондоо юу ч алга</p>
          <p className="text-xs text-muted-foreground">
            {canUpload
              ? "Файлаа энд чирж оруулах эсвэл зүүн талын “Шинэ” дарна уу."
              : isTrash
                ? "Хогийн сав хоосон."
                : "Танд энд нэмэх эрх алга."}
          </p>
        </div>
      )}

      {/* ── Олон файл сонгосон үеийн үйлдлүүд ── */}
      {selectedCount > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto mt-6 flex w-fit max-w-full items-center gap-1 rounded-full bg-primary px-2 py-1.5 text-sm text-primary-foreground shadow-card">
          <button
            type="button"
            onClick={clearSelection}
            title="Сонголтыг цуцлах"
            className="cursor-pointer rounded-full p-1.5 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="whitespace-nowrap px-1.5 font-medium">{selectedCount} сонгосон</span>
          {!isTrash && (
            <button
              type="button"
              onClick={() =>
                setMoving({
                  files: selectedFiles.map((f) => ({ id: f.id, name: f.name })),
                  folders: selectedFolders.map((f) => ({ id: f.id, name: f.name })),
                })
              }
              className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/10"
            >
              <FolderInput className="h-4 w-4" /> Зөөх
            </button>
          )}
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={bulkDeleting}
            className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive px-3 py-1.5 text-white hover:bg-destructive/90 disabled:opacity-70"
          >
            {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Устгах
          </button>
        </div>
      )}

      {/* ── Чирж оруулах үеийн давхарга ── */}
      {(dragActive || uploading) && (
        <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal bg-background/85 text-teal">
          {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
          <p className="text-sm font-medium">
            {uploading ? "Оруулж байна…" : `Энд тавиад “${breadcrumb.at(-1)?.name ?? (flattened ? role?.label : project.name)}”-д оруулна`}
          </p>
        </div>
      )}

      {canShare && (
        <ShareDialog
          key={project.id}
          project={project}
          isOwner={isOwner}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onChanged={refresh}
        />
      )}
      {moving && (
        <MoveFileDialog
          files={moving.files}
          folders={moving.folders}
          currentProjectId={project.id}
          open={Boolean(moving)}
          onOpenChange={(next) => {
            if (!next) setMoving(null);
          }}
          onMoved={async () => {
            clearSelection();
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function Crumb({ href, label, last }: { href: string; label: string; last: boolean }) {
  return (
    <>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      <Link
        href={href}
        className={cn(
          "max-w-[14rem] truncate rounded-md px-1.5 py-0.5 hover:bg-muted md:max-w-xs",
          last ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Link>
    </>
  );
}

function FolderRow({
  folder,
  href,
  color,
  count,
  selection,
  actions,
}: {
  folder: ApiFolder;
  href: string;
  color: string;
  count: number;
  selection?: { checked: boolean; active: boolean; onToggle: (shift: boolean) => void };
  actions: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group grid grid-cols-[1fr_auto] items-center gap-4 rounded-md px-2 transition-colors hover:bg-accent/50 sm:grid-cols-[1fr_80px_auto] md:grid-cols-[1fr_140px_130px_80px_auto]",
        selection?.checked && "bg-teal/10 hover:bg-teal/15",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {selection && <RowCheckbox label={folder.name} selection={selection} />}
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center">
            <FolderIcon className="h-[18px] w-[18px]" style={{ color }} fill={color} fillOpacity={0.2} />
          </span>
          <span className="truncate font-medium">{folder.name}</span>
        </Link>
      </div>
      <span className="hidden text-xs text-muted-foreground md:block">—</span>
      <span className="hidden text-xs text-muted-foreground md:block">{shortDate(folder.createdAt)}</span>
      <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
        {count} зүйл
      </span>
      <span className="flex w-7 justify-end opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        {actions}
      </span>
    </div>
  );
}

function RowCheckbox({
  label,
  selection,
}: {
  label: string;
  selection: { checked: boolean; active: boolean; onToggle: (shift: boolean) => void };
}) {
  return (
    <input
      type="checkbox"
      aria-label={`${label} сонгох`}
      checked={selection.checked}
      onChange={() => undefined}
      onClick={(e) => selection.onToggle(e.shiftKey)}
      className={cn(
        "size-4 shrink-0 cursor-pointer accent-teal transition-opacity [@media(hover:none)]:opacity-100",
        selection.checked || selection.active
          ? "opacity-100"
          : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
      )}
    />
  );
}

function FileRow({
  file,
  projectId,
  meId,
  selection,
  actions,
}: {
  file: ApiProjectFile;
  projectId: string;
  meId: string;
  // Өгөөгүй бол сонгох checkbox харагдахгүй (эрхгүй хэрэглэгч)
  selection?: { checked: boolean; active: boolean; onToggle: (shift: boolean) => void };
  actions: React.ReactNode;
}) {
  const owner =
    file.uploaderId === meId ? "Би" : file.uploader?.nickname || file.uploader?.email || "—";
  return (
    <div
      className={cn(
        "group grid grid-cols-[1fr_auto] items-center gap-4 rounded-md px-2 transition-colors hover:bg-accent/50 sm:grid-cols-[1fr_80px_auto] md:grid-cols-[1fr_140px_130px_80px_auto]",
        selection?.checked && "bg-teal/10 hover:bg-teal/15",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {selection && <RowCheckbox label={file.name} selection={selection} />}
        <Link
          href={`/dashboard/file?folderId=${projectId}&fileId=${file.id}`}
          className="flex min-w-0 items-center gap-2.5 py-1.5"
        >
          <FileTypeIcon name={file.name} mimeType={file.mimeType} />
          <span className="truncate">{file.name}</span>
          {file.isLocked && (
            <span className="shrink-0 rounded bg-destructive/10 px-1 text-[10px] text-destructive">
              түгжээтэй
            </span>
          )}
        </Link>
        {/* Координатын файл → Хэрэгслүүд › Координат харагч */}
        {isCoordinateFileName(file.name) && (file.versions?.length ?? 0) > 0 && (
          <Link
            href={`/dashboard/tools/coordinates?fileId=${file.id}`}
            title="Зураг дээр харах, талбай тооцох"
            className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-800 hover:bg-green-200"
          >
            <MapPin className="h-3 w-3" />
            <span className="hidden sm:inline">Зураг дээр харах</span>
          </Link>
        )}
      </div>
      <span className="hidden truncate text-xs text-muted-foreground md:block">{owner}</span>
      <span className="hidden text-xs text-muted-foreground md:block">{shortDate(file.updatedAt)}</span>
      <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
        {file.versions?.length ? getFileSize(file) : "—"}
      </span>
      <span className="flex w-7 justify-end opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        {actions}
      </span>
    </div>
  );
}

function IconAction({
  title,
  onClick,
  icon: Icon,
  destructive = false,
  busy = false,
}: {
  title: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={busy}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-10">
      <p className="text-muted-foreground">{message}</p>
      <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
        Нүүр рүү буцах
      </Link>
    </div>
  );
}

export default function DashboardProjectPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProjectPageContent />
    </Suspense>
  );
}

function ProjectPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const dir = searchParams.get("dir");
  if (!projectId) return <EmptyState message="Олдсонгүй." />;
  return <ProjectFilesPage projectId={projectId} dir={dir} />;
}
