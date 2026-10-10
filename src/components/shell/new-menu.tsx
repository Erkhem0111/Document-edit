"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardList,
  FilePlus,
  FolderPlus,
  Loader2,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDialog } from "@/components/project/task-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useCreateDocument } from "@/hooks/use-create-document";
import { notifyProjectsChanged, useProjectFolder } from "@/hooks/use-project-folders";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { cn } from "@/lib/utils";

// ─── "＋ Шинэ" — үүсгэх бүх үйлдлийн ганц газар ─────────────────────────────
// Одоо нээлттэй байгаа төсөл/хавтаст үүсгэнэ. Төсөл нээгээгүй (нүүр, даалгавар
// г.м.) үед "Private" доторх хувийн хавтаст үүснэ. Хаана үүсэхийг цэсийн
// толгойд тодорхой бичнэ — хэрэглэгч "хаашаа орчихов" гэж төөрөхгүй.

async function getPersonalWorkspaceId() {
  const res = await fetch("/api/workspace/personal", { method: "POST" });
  if (!res.ok) throw new Error("Хувийн хавтас бэлдэж чадсангүй.");
  return ((await res.json()) as { projectId: string }).projectId;
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function NewMenu({ onNewProject }: { onNewProject: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { user } = useAuth();
  const { createDocument, creating } = useCreateDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);

  // Одоогийн байршил
  const contextProjectId =
    pathname === "/dashboard/project"
      ? sp.get("projectId")
      : pathname === "/dashboard/file"
        ? sp.get("folderId")
        : null;
  const dir = pathname === "/dashboard/project" ? sp.get("dir") : null;
  const { project } = useProjectFolder(contextProjectId ?? "");
  const here = contextProjectId ? project : null;

  // Эрх (сервер дахин шалгана — энд зөвхөн товчийг идэвхгүй болгох зорилготой)
  const myRole = here?.members?.find((m) => m.user?.id === user?.id)?.role;
  const isAdmin = user?.role === "ADMIN";
  const inTrash = Boolean(here?.trashedAt);
  const isReference = here?.visibility === "REFERENCE";
  const isOwner = isAdmin || myRole === "OWNER";
  const isEditor = isOwner || myRole === "EDITOR";
  const canAddFiles = !here || (!inTrash && (isOwner || (isEditor && !isReference)));
  const canCreateDoc = !here || (!inTrash && !isReference && isEditor);
  const canTask = Boolean(here) && !inTrash && isEditor;
  const blockedReason = !here
    ? null
    : inTrash
      ? "Хогийн саванд үүсгэх боломжгүй"
      : isReference && !isOwner
        ? "Лавлах материалыг зөвхөн эзэмшигч нэмнэ"
        : !isEditor
          ? "Танд энд засах эрх алга"
          : null;
  const targetLabel = here
    ? here.name
    : contextProjectId
      ? "…"
      : "Private (хувийн хавтас)";

  async function resolveTarget() {
    return contextProjectId ?? (await getPersonalWorkspaceId());
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" хэтэрхий том байна (дээд тал нь 50MB).`);
      return;
    }
    setBusy(true);
    try {
      const projectId = await resolveTarget();
      let ok = 0;
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        if (dir) form.append("folderId", dir);
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          toast.error(`"${file.name}": ${await readError(res, "оруулж чадсангүй")}`);
          continue;
        }
        ok += 1;
      }
      if (ok > 0) {
        toast.success(ok === 1 ? "Файл орлоо" : `${ok} файл орлоо`);
        notifyProjectsChanged();
        // Хувийн хавтаст орсон бол тийшээ шилжүүлж харуулна
        if (!contextProjectId) router.push(`/dashboard/project?projectId=${projectId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Файл оруулж чадсангүй.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createFolder() {
    const name = folderName.trim();
    if (!name) {
      toast.error("Хавтасны нэрээ оруулна уу");
      return;
    }
    setBusy(true);
    try {
      const projectId = await resolveTarget();
      const res = await fetch(`/api/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: dir }),
      });
      if (!res.ok) throw new Error(await readError(res, "Хавтас үүсгэж чадсангүй."));
      const data = (await res.json().catch(() => null)) as { folder?: { id: string } } | null;
      toast.success(`"${name}" хавтас үүслээ`);
      setFolderOpen(false);
      setFolderName("");
      notifyProjectsChanged();
      // Шинэ хавтас руу шууд орно
      router.push(
        data?.folder?.id
          ? `/dashboard/project?projectId=${projectId}&dir=${data.folder.id}`
          : `/dashboard/project?projectId=${projectId}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хавтас үүсгэж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  function pick(action: () => void) {
    setOpen(false);
    action();
  }

  const working = busy || creating;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={working}
        className="flex items-center gap-2.5 rounded-xl bg-card px-4 py-2.5 text-sm font-semibold text-primary shadow-soft transition hover:shadow-card disabled:opacity-70"
      >
        {working ? (
          <Loader2 className="h-4 w-4 animate-spin text-teal" />
        ) : (
          <Plus className="h-4 w-4 text-teal" strokeWidth={2.5} />
        )}
        Шинэ
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover py-1.5 text-sm text-popover-foreground shadow-card">
            <div className="truncate px-3.5 pb-1.5 pt-1 text-[11px] text-muted-foreground">
              Энд үүснэ: <span className="font-medium text-foreground">{targetLabel}</span>
            </div>
            <MenuItem
              icon={FilePlus}
              label="Шинэ баримт"
              disabled={!canCreateDoc}
              onClick={() =>
                pick(() =>
                  void createDocument(
                    contextProjectId ? { projectId: contextProjectId, folderId: dir } : {},
                  ),
                )
              }
            />
            <MenuItem
              icon={FolderPlus}
              label="Шинэ хавтас"
              disabled={!canAddFiles}
              onClick={() => pick(() => setFolderOpen(true))}
            />
            <MenuItem
              icon={Upload}
              label="Файл оруулах"
              hint="PDF, Excel, DWG…"
              disabled={!canAddFiles}
              onClick={() => pick(() => fileInputRef.current?.click())}
            />
            {here && (
              <MenuItem
                icon={ClipboardList}
                label="Даалгавар"
                disabled={!canTask}
                onClick={() => pick(() => setTaskOpen(true))}
              />
            )}
            {blockedReason && (
              <p className="px-3.5 pb-1 pt-0.5 text-[11px] text-muted-foreground">{blockedReason}</p>
            )}
            <div className="my-1.5 h-px bg-border" />
            <MenuItem
              icon={Users}
              label="Шинэ төсөл"
              hint="багаар ажиллах"
              onClick={() => pick(onNewProject)}
            />
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
      />

      <Dialog
        open={folderOpen}
        onOpenChange={(next) => {
          setFolderOpen(next);
          if (!next) setFolderName("");
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Шинэ хавтас</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createFolder();
            }}
            placeholder="Хавтасны нэр"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderOpen(false)}>
              Болих
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={busy}
              onClick={() => void createFolder()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Үүсгэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {here && <TaskDialog project={here} open={taskOpen} onOpenChange={setTaskOpen} />}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  disabled = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-accent",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="whitespace-nowrap">{label}</span>
      {hint && <span className="ml-auto whitespace-nowrap pl-3 text-[11px] text-muted-foreground">{hint}</span>}
    </button>
  );
}
