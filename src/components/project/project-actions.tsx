"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Loader2,
  Trash2,
  RotateCcw,
  FolderInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyProjectsChanged } from "@/hooks/use-project-folders";
import {
  VISIBILITY_FOLDERS,
  getProjectFolderKey,
  type FolderKey,
} from "@/lib/folders";
import type { ApiProject, ProjectVisibility } from "@/types/domain";

// Project (folder)-ийг хогийн сав руу зөөх / сэргээх / өөр folder руу зөөх цэс.
// Backend нь PATCH/DELETE дээр OWNER эрх шаарддаг тул owner/admin-д л харуулна.
export function ProjectActions({
  project,
  onChanged,
  disabled = false,
}: {
  project: ApiProject;
  onChanged: () => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const folderKey: FolderKey = getProjectFolderKey(project);

  async function run(
    request: () => Promise<Response>,
    successMsg: string,
    after: () => void,
  ) {
    // Цэсийг шууд хааж, товчин дээр спиннер эргэлдэнэ — дарагдсан нь мэдэгдэнэ
    setOpen(false);
    setBusy(true);
    try {
      const res = await request();
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Үйлдэл амжилтгүй боллоо.");
      }
      toast.success(successMsg);
      notifyProjectsChanged(); // зүүн sidebar шууд шинэчлэгдэнэ
      after();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Үйлдэл амжилтгүй боллоо.");
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>) =>
    fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // Visibility солих = доторх БҮХ файлын хандалт өөрчлөгдөнө — заавал баталгаажуулна
  const VISIBILITY_WARNINGS: Record<ProjectVisibility, string> = {
    PUBLIC: "Компанийн БҮХ хэрэглэгч доторх бүх файлыг харах боломжтой болно.",
    SHARED: "Зөвхөн таны урьсан гишүүд харна. Урьсан гишүүдийн эрх хэвээр үлдэнэ.",
    PRIVATE:
      "Зөвхөн та өөрөө харна — бусад бүх гишүүний хандалт шууд хаагдана.",
    REFERENCE:
      "Бүх хэрэглэгч харах боловч хэн ч засаж чадахгүй (read-only) болно.",
  };

  function moveTo(visibility: ProjectVisibility) {
    const ok = window.confirm(
      `"${project.name}"-ийг ${visibility} folder руу зөөх гэж байна.\n\n⚠ ${VISIBILITY_WARNINGS[visibility]}\n\nҮргэлжлүүлэх үү?`,
    );
    if (!ok) return;
    void run(() => patch({ visibility }), "Зөөгдлөө", () =>
      router.push(`/dashboard/folder?key=${visibility}`),
    );
  }

  function moveToTrash() {
    void run(
      () => fetch(`/api/projects/${project.id}`, { method: "DELETE" }),
      "Хогийн сав руу зөөгдлөө",
      () => router.push("/dashboard/folder?key=TRASH"),
    );
  }

  function restore() {
    void run(() => patch({ trashed: false }), "Сэргээгдлээ", onChanged);
  }

  // Archive хасагдсан — хуучин архивласан төслийг энгийн болгоно
  function unarchive() {
    void run(() => patch({ isArchived: false }), "Архиваас гаргалаа", onChanged);
  }

  function deletePermanent() {
    if (!window.confirm("Энэ төслийг бүр мөсөн устгах уу? Буцаах боломжгүй.")) {
      return;
    }
    void run(
      () =>
        fetch(`/api/projects/${project.id}?permanent=true`, {
          method: "DELETE",
        }),
      "Бүр мөсөн устгагдлаа",
      () => router.push("/dashboard/folder?key=TRASH"),
    );
  }

  const isVisibility = VISIBILITY_FOLDERS.some((f) => f.key === folderKey);

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || disabled}
        title={disabled ? "Reference folder read-only" : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MoreHorizontal className="size-4" />
        )}
      </Button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-popover p-1 text-sm shadow-card">
            {isVisibility && (
              <>
                <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <FolderInput className="mr-1 inline size-3" /> Зөөх
                </div>
                {VISIBILITY_FOLDERS.filter((f) => f.key !== folderKey).map(
                  (f) => (
                    <MenuItem
                      key={f.key}
                      onClick={() => moveTo(f.key as ProjectVisibility)}
                    >
                      <f.icon className="size-4" style={{ color: f.color }} />
                      {f.label}
                    </MenuItem>
                  ),
                )}
                <Separator />
                {project.isArchived && (
                  <MenuItem onClick={unarchive}>
                    <RotateCcw className="size-4" /> Архиваас гаргах
                  </MenuItem>
                )}
                <MenuItem onClick={moveToTrash} destructive>
                  <Trash2 className="size-4" /> Хогийн сав руу
                </MenuItem>
              </>
            )}

            {folderKey === "TRASH" && (
              <>
                <MenuItem onClick={restore}>
                  <RotateCcw className="size-4" /> Сэргээх
                </MenuItem>
                <MenuItem onClick={deletePermanent} destructive>
                  <Trash2 className="size-4" /> Бүр мөсөн устгах
                </MenuItem>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-accent ${
        destructive ? "text-destructive" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-border" />;
}
