"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Folder as FolderIcon, FolderOpen, Loader2, LogIn, RotateCcw, Trash2 } from "lucide-react";
import { formatBytes, notifyProjectsChanged, useProjectFolders } from "@/hooks/use-project-folders";
import { getFolder, getProjectFolderKey, type FolderKey } from "@/lib/folders";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const ensuringRef = useRef(false);

  const items = folder ? projects.filter((p) => getProjectFolderKey(p) === folder.key) : [];
  const isPrivate = folder?.key === "PRIVATE";
  const isCompanyWide = folder?.key === "PUBLIC" || folder?.key === "REFERENCE";
  // Private: өөрийн ажлын орчин (байхгүй бол үүсгэнэ).
  // Public/Reference: компанийн НЭГ нийтийн орчин — ганцаараа бол шууд нээнэ,
  // хэд байвал жагсаана. Зөвхөн админ анхны орчныг үүсгэнэ (өмнө нь гишүүн биш
  // хүн бүр дарахад ижил нэртэй шинэ төсөл үүсдэг байсан).
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

  async function act(project: ApiProject, kind: "restore" | "delete") {
    if (
      kind === "delete" &&
      !window.confirm(`"${project.name}"-ийг доторх бүх файлтай нь бүр мөсөн устгах уу? Буцаах боломжгүй.`)
    ) {
      return;
    }
    setBusyId(project.id);
    try {
      const res =
        kind === "restore"
          ? await fetch(`/api/projects/${project.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ trashed: false }),
            })
          : await fetch(`/api/projects/${project.id}?permanent=true`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Амжилтгүй боллоо.");
      }
      toast.success(kind === "restore" ? "Сэргээгдлээ" : "Бүр мөсөн устгагдлаа");
      await refresh();
      notifyProjectsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Амжилтгүй боллоо.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 font-sans text-lg md:text-xl">
          <Icon className="h-5 w-5" style={{ color: folder.color }} />
          {folder.label}
        </h1>
        <p className="text-xs text-muted-foreground">{folder.description}</p>
        {folder.key === "SHARED" && (
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogIn className="h-3.5 w-3.5" /> Кодоор нэгдэх
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-5 text-sm">
        {items.length > 0 && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground sm:grid-cols-[1fr_70px_80px_auto] md:grid-cols-[1fr_110px_70px_80px_auto]">
            <span>Нэр</span>
            <span className="hidden md:block">{isTrash ? "Устгасан" : "Үүсгэсэн"}</span>
            <span className="hidden text-right sm:block">Файл</span>
            <span className="hidden text-right sm:block">Хэмжээ</span>
            <span className={isTrash ? "w-16" : "w-0"} />
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
                “＋ Шинэ” → “Шинэ төсөл” дарж багтайгаа хамтран ажиллах төсөл үүсгэнэ.
              </p>
            )}
          </div>
        ) : (
          items.map((project) => (
            <div
              key={project.id}
              className="group grid grid-cols-[1fr_auto] items-center gap-4 rounded-md px-2 transition-colors hover:bg-accent/50 sm:grid-cols-[1fr_70px_80px_auto] md:grid-cols-[1fr_110px_70px_80px_auto]"
            >
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
              </Link>
              <span className="hidden text-xs text-muted-foreground md:block">
                {format(new Date(isTrash && project.trashedAt ? project.trashedAt : project.createdAt), "yyyy.MM.dd")}
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {project._count?.files ?? 0}
              </span>
              <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                {Number(project.totalSize ?? 0) > 0 ? formatBytes(project.totalSize) : "—"}
              </span>
              <span className={`flex justify-end gap-0.5 ${isTrash ? "w-16" : "w-0"}`}>
                {isTrash && (
                  <>
                    <button
                      type="button"
                      title="Сэргээх"
                      disabled={busyId === project.id}
                      onClick={() => void act(project, "restore")}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Бүр мөсөн устгах"
                      disabled={busyId === project.id}
                      onClick={() => void act(project, "delete")}
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

      {folder.key === "SHARED" && (
        <NewProjectDialog open={joinOpen} onOpenChange={setJoinOpen} initialTab="join" />
      )}
    </div>
  );
}
