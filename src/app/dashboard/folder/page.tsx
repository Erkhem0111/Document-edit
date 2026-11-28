"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Folder as FolderIcon, FolderOpen, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import {
  formatBytes,
  notifyProjectsChanged,
  useProjectFolders,
  useProjectSizes,
} from "@/hooks/use-project-folders";
import { getFolder, getProjectFolderKey, isCompanyWide as isPublicProject, type FolderKey } from "@/lib/folders";
import { PageSkeleton, ListRowsSkeleton } from "@/components/skeletons";
import { useAuth } from "@/hooks/use-auth";
import type { ApiProject } from "@/types/domain";

// ─── Folder (хандалтын төрөл) хуудас ──────────────────────────────────────────
// Private / Public / Reference — хэрэглэгчийн ажлын орчин руу шууд оруулна.
// Shared — төслүүдийн жагсаалт. Хогийн сав — сэргээх / бүр мөсөн устгах.
// Шинэ төсөл үүсгэх нь зүүн талын "＋ Шинэ"-д (энд давхар товч байхгүй).

export default function DashboardFolderPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FolderPageContent />
    </Suspense>
  );
}

function FolderPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const key = (searchParams.get("key") ?? "PRIVATE") as FolderKey;
  const folder = getFolder(key);
  const { projects, loading, error, refresh } = useProjectFolders();
  // Хэмжээг тусад нь (хүнд SQL) — зөвхөн энэ хуудсанд
  const sizes = useProjectSizes();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Админ: "Төслүүд" болон "Хогийн сав" дээр олон төсөл сонгож зэрэг устгана
  const [picked, setPicked] = useState<{ key: string; ids: Set<string> }>({ key, ids: new Set() });
  const selected = picked.key === key ? picked.ids : new Set<string>();
  const [bulkBusy, setBulkBusy] = useState(false);
  const ensuringRef = useRef(false);

  const items = folder ? projects.filter((p) => getProjectFolderKey(p) === folder.key) : [];
  const isPrivate = folder?.key === "PRIVATE";
  const isCompanyWide = folder?.key === "REFERENCE";
  // Миний файлууд: өөрийн ажлын орчин (байхгүй бол үүсгэнэ).
  // Компанийн сан: компанийн НЭГ сан — ганцаараа бол шууд нээнэ, хэд байвал
  // жагсаана. Зөвхөн админ анх үүсгэнэ.
  const target = isPrivate
    ? items.find((project) => (project.members?.length ?? 0) > 0)
    : isCompanyWide && items.length === 1
      ? items[0]
      : undefined;
  const canCreate = isPrivate || (isCompanyWide && items.length === 0 && user?.role === "ADMIN");
  const directWorkspace = Boolean(target) || (canCreate && !loading && !error);

  useEffect(() => {
    if (!folder || loading || error || ensuringRef.current) return;

    if (target) {
      router.replace(`/dashboard/project?projectId=${target.id}`);
      return;
    }
    if (!canCreate) return;

    const role = folder;
    ensuringRef.current = true;
    queueMicrotask(async () => {
      try {
        // Private → хэрэглэгчийн "Миний баримтууд" (давхардахгүй ганц орчин);
        // Public/Reference (зөвхөн админ, анх удаа) → компанийн нийтийн орчин
        const res = isPrivate
          ? await fetch("/api/workspace/personal", { method: "POST" })
          : await fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: role.label, visibility: role.key }),
            });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "Бэлдэж чадсангүй.");
        }
        const data = (await res.json()) as { projectId?: string; project?: ApiProject };
        const id = data.projectId ?? data.project?.id;
        notifyProjectsChanged();
        if (id) router.replace(`/dashboard/project?projectId=${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Бэлдэж чадсангүй.");
        ensuringRef.current = false;
      }
    });
  }, [canCreate, error, folder, isPrivate, loading, router, target]);

  if (!folder) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Олдсонгүй.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
          Нүүр рүү буцах
        </Link>
      </div>
    );
  }

  if (directWorkspace || (loading && (isPrivate || isCompanyWide))) return <PageSkeleton />;

  const Icon = folder.icon;
  const isTrash = folder.key === "TRASH";
  // Шууд устгах (жагсаалтаас) — зөвхөн админ, "Төслүүд" болон "Хогийн сав"
  const canManage = user?.role === "ADMIN" && (folder.key === "SHARED" || isTrash);
  const selectedItems = items.filter((p) => selected.has(p.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const fileTotal = (list: ApiProject[]) => list.reduce((sum, p) => sum + (p._count?.files ?? 0), 0);

  function setSelection(ids: Set<string>) {
    setPicked({ key, ids });
  }

  function toggle(id: string) {
    const ids = new Set(selected);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    setSelection(ids);
  }

  // Хогийн сав руу зөөх / сэргээх / бүр мөсөн устгах — олон төсөлд дараалан
  async function runMany(list: ApiProject[], kind: "trash" | "restore" | "delete") {
    if (list.length === 0) return;
    const files = fileTotal(list);
    const what = list.length === 1 ? `“${list[0].name}” төслийг` : `${list.length} төслийг`;
    const filesText = files > 0 ? ` доторх ${files} файлтай нь` : "";
    const question =
      kind === "trash"
        ? `${what}${filesText} хогийн сав руу зөөх үү?\n\nХавтас, файлууд нь бүгд хамт очно. Хогийн савнаас сэргээж болно.`
        : kind === "delete"
          ? `${what}${filesText} бүр мөсөн устгах уу?\n\nБУЦААХ БОЛОМЖГҮЙ — бүх файл хадгалах сангаас устана.`
          : null;
    if (question && !window.confirm(question)) return;

    setBulkBusy(true);
    if (list.length === 1) setBusyId(list[0].id);
    let ok = 0;
    const failed: string[] = [];
    for (const project of list) {
      try {
        const res =
          kind === "delete"
            ? await fetch(`/api/projects/${project.id}?permanent=true`, { method: "DELETE" })
            : await fetch(`/api/projects/${project.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trashed: kind === "trash" }),
              });
        if (res.ok) ok += 1;
        else failed.push(project.name);
      } catch {
        failed.push(project.name);
      }
    }
    setBulkBusy(false);
    setBusyId(null);
    setSelection(new Set());
    if (ok > 0) {
      const done = kind === "trash" ? "хогийн сав руу зөөгдлөө" : kind === "restore" ? "сэргээгдлээ" : "бүр мөсөн устгагдлаа";
      toast.success(ok === 1 && list.length === 1 ? `“${list[0].name}” ${done}` : `${ok} төсөл ${done}`);
    }
    if (failed.length > 0) toast.error(`Амжилтгүй: ${failed.join(", ")}`);
    await refresh();
    notifyProjectsChanged();
  }

  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 font-sans text-lg md:text-xl">
          <Icon className="h-5 w-5" style={{ color: folder.color }} />
          {folder.label}
        </h1>
        <p className="text-xs text-muted-foreground">{folder.description}</p>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-5 text-sm">
        {items.length > 0 && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground sm:grid-cols-[1fr_70px_80px_auto] md:grid-cols-[1fr_110px_70px_80px_auto]">
            <span className="flex items-center gap-2.5">
              {canManage && (
                <input
                  type="checkbox"
                  aria-label="Бүгдийг сонгох"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedItems.length > 0 && !allSelected;
                  }}
                  onChange={() => setSelection(allSelected ? new Set() : new Set(items.map((p) => p.id)))}
                  className="size-4 cursor-pointer accent-teal"
                />
              )}
              Нэр
            </span>
            <span className="hidden md:block">{isTrash ? "Устгасан" : "Үүсгэсэн"}</span>
            <span className="hidden text-right sm:block">Файл</span>
            <span className="hidden text-right sm:block">Хэмжээ</span>
            <span className={isTrash ? "w-16" : canManage ? "w-8" : "w-0"} />
          </div>
        )}

        {loading && items.length === 0 ? (
          <ListRowsSkeleton rows={4} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="text-sm text-foreground">
              {isTrash ? "Хогийн сав хоосон" : isCompanyWide ? "Одоохондоо хоосон байна" : "Төсөл алга"}
            </p>
            {isCompanyWide && (
              <p className="text-xs text-muted-foreground">
                Энэ хэсгийг админ анх нээж бэлдэнэ.
              </p>
            )}
            {folder.key === "SHARED" && (
              <p className="text-xs text-muted-foreground">
                <span className="hidden md:inline">Зүүн талын</span>
                <span className="md:hidden">☰ цэсний</span> “Шинэ” → “Шинэ төсөл” дарж багтайгаа хамтран ажиллах төсөл үүсгэнэ.
              </p>
            )}
          </div>
        ) : (
          items.map((project) => (
            <div
              key={project.id}
              className={`group grid grid-cols-[1fr_auto] items-center gap-4 rounded-md px-2 transition-colors hover:bg-accent/50 sm:grid-cols-[1fr_70px_80px_auto] md:grid-cols-[1fr_110px_70px_80px_auto] ${
                selected.has(project.id) ? "bg-teal/10 hover:bg-teal/15" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
              {canManage && (
                <input
                  type="checkbox"
                  aria-label={`${project.name} сонгох`}
                  checked={selected.has(project.id)}
                  onChange={() => toggle(project.id)}
                  className="size-4 shrink-0 cursor-pointer accent-teal"
                />
              )}
              <Link
                href={`/dashboard/project?projectId=${project.id}`}
                className="flex min-w-0 items-center gap-2.5 py-2"
              >
                <FolderIcon
                  className="h-4 w-4 shrink-0"
                  style={{ color: folder.color }}
                  fill={folder.color}
                  fillOpacity={0.15}
                />
                <span className="truncate">{project.name}</span>
                {isPublicProject(project) && (
                  <span className="shrink-0 rounded-full bg-teal/10 px-1.5 py-px text-[10px] text-teal">
                    Бүх компани
                  </span>
                )}
              </Link>
              </span>
              <span className="hidden text-xs text-muted-foreground md:block">
                {format(new Date(isTrash && project.trashedAt ? project.trashedAt : project.createdAt), "yyyy.MM.dd")}
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {project._count?.files ?? 0}
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {Number(sizes?.[project.id] ?? 0) > 0 ? formatBytes(sizes?.[project.id]) : "—"}
              </span>
              <span className={`flex justify-end gap-0.5 ${isTrash ? "w-16" : canManage ? "w-8" : "w-0"}`}>
                {canManage && !isTrash && (
                  <button
                    type="button"
                    title="Хогийн сав руу (доторх файлтай нь)"
                    aria-label={`${project.name} устгах`}
                    disabled={busyId === project.id}
                    onClick={() => void runMany([project], "trash")}
                    className="cursor-pointer rounded-md p-1.5 text-destructive opacity-60 hover:bg-destructive/10 hover:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    {busyId === project.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
                {isTrash && (
                  <>
                    <button
                      type="button"
                      title="Сэргээх"
                      disabled={busyId === project.id}
                      onClick={() => void runMany([project], "restore")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Бүр мөсөн устгах"
                      disabled={busyId === project.id}
                      onClick={() => void runMany([project], "delete")}
                      className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      {busyId === project.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {canManage && selectedItems.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto mt-6 flex w-fit max-w-full items-center gap-1 rounded-full bg-primary px-2 py-1.5 text-sm text-primary-foreground shadow-card">
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            title="Сонголтыг цуцлах"
            className="cursor-pointer rounded-full p-1.5 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="whitespace-nowrap px-1.5 font-medium">
            {selectedItems.length} сонгосон
            <span className="hidden font-normal opacity-70 sm:inline"> · {fileTotal(selectedItems)} файл</span>
          </span>
          {isTrash && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runMany(selectedItems, "restore")}
              className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/10 disabled:opacity-70"
            >
              <RotateCcw className="h-4 w-4" /> Сэргээх
            </button>
          )}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runMany(selectedItems, isTrash ? "delete" : "trash")}
            className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive px-3 py-1.5 text-white hover:bg-destructive/90 disabled:opacity-70"
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isTrash ? "Бүр мөсөн устгах" : "Устгах"}
          </button>
        </div>
      )}
    </div>
  );
}
