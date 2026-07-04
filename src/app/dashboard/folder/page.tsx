"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  formatBytes,
  notifyProjectsChanged,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import { getFolder, getProjectFolderKey, type FolderKey } from "@/lib/folders";
import { SharedAccess } from "@/components/project/invite";
import type { ApiProject } from "@/types/domain";
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
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Folder as FolderIcon,
  Trash2,
} from "lucide-react";

// Folder доторх бүх файлын нийт багтаамж
function folderSize(project: ApiProject): number {
  return (project.files ?? []).reduce(
    (sum, f) => sum + Number(f.versions?.[0]?.fileSize ?? 0),
    0,
  );
}

export default function DashboardFolderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <FolderPageContent />
    </Suspense>
  );
}

function FolderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const key = (searchParams.get("key") ?? "PRIVATE") as FolderKey;
  const folder = getFolder(key);
  const { projects, loading, error, refresh } = useProjectFolders();
  const [preparing, setPreparing] = useState(false);
  const ensuringRef = useRef(false);

  const Icon = folder?.icon;
  const items = folder
    ? projects.filter((p) => getProjectFolderKey(p) === folder.key)
    : [];
  const directWorkspace =
    folder?.kind === "visibility" && folder.key !== "SHARED";
  const memberProject = items.find((project) => (project.members?.length ?? 0) > 0);

  useEffect(() => {
    if (!folder || !directWorkspace || loading || error || ensuringRef.current) {
      return;
    }

    if (memberProject) {
      router.replace(`/dashboard/project?projectId=${memberProject.id}`);
      return;
    }

    const targetFolder = folder;
    ensuringRef.current = true;
    setPreparing(true);
    async function ensureWorkspace() {
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: targetFolder.label,
            visibility: targetFolder.key,
          }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { message?: string }
            | null;
          throw new Error(body?.message ?? "Failed to prepare workspace.");
        }
        const data = (await response.json()) as { project: ApiProject };
        router.replace(`/dashboard/project?projectId=${data.project.id}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to prepare workspace.",
        );
        setPreparing(false);
        ensuringRef.current = false;
      }
    }

    void ensureWorkspace();
  }, [directWorkspace, error, folder, loading, memberProject, router]);

  if (!folder || !Icon) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Folder not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
          Back to workspace
        </Link>
      </div>
    );
  }

  async function createProject(name: string) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility: folder!.key }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      throw new Error(body?.message ?? "Failed to create project.");
    }
    await refresh();
    notifyProjectsChanged();
  }

  async function deletePermanent(project: ApiProject) {
    const ok = window.confirm(
      `"${project.name}" folder-ийг DB-ээс бүр мөсөн устгах уу?`,
    );
    if (!ok) return;

    const response = await fetch(`/api/projects/${project.id}?permanent=true`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      toast.error(body?.message ?? "Permanent delete failed.");
      return;
    }
    toast.success("Бүр мөсөн устгалаа.");
    await refresh();
    notifyProjectsChanged();
  }

  if (directWorkspace) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-10 text-sm text-muted-foreground">
        {loading || preparing ? "Preparing workspace..." : "Opening workspace..."}
      </div>
    );
  }

  return (
    <div className="px-10 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Workspace
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklch, ${folder.color} 16%, transparent)`,
            color: folder.color,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-4xl text-primary">{folder.label}</h1>
          <p className="text-sm text-muted-foreground">{folder.description}</p>
        </div>

        {/* Баруун талын үйлдэл: SHARED → Create/Join, бусад visibility → New folder */}
        <div className="ml-auto">
          {folder.key === "SHARED" ? (
            <SharedAccess />
          ) : (
            folder.kind === "visibility" && (
              <NewFolderButton
                onCreate={createProject}
                label={folder.label}
              />
            )
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Жагсаалт */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[1fr_170px_90px_110px_40px] border-b border-border bg-muted/40 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Name</span>
          <span>Created</span>
          <span>Files</span>
          <span>Size</span>
          <span />
        </div>

        {loading && items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            {folder.kind === "lifecycle"
              ? "Хоосон байна."
              : folder.key === "REFERENCE"
                ? "Reference folder read-only — upload хийсэн файлуудыг л харна."
              : "Folder алга. Дээрх товчоор шинэ folder үүсгэ."}
          </div>
        ) : (
          items.map((project) => {
            const size = folderSize(project);
            return (
              <div
                key={project.id}
                className="grid grid-cols-[1fr_170px_90px_110px_40px] items-center border-b border-border/60 px-5 py-3 text-sm transition hover:bg-accent/40 last:border-b-0"
              >
                <Link
                  href={`/dashboard/project?projectId=${project.id}`}
                  className="flex min-w-0 items-center gap-3"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${folder.color} 16%, transparent)`,
                      color: folder.color,
                    }}
                  >
                    <FolderIcon className="h-4 w-4" />
                  </div>
                  <span className="truncate font-medium text-foreground">
                    {project.name}
                  </span>
                </Link>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(project.createdAt), "MMM d, yyyy HH:mm")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {project._count?.files ?? project.files?.length ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  {size > 0 ? formatBytes(String(size)) : "-"}
                </span>
                <span className="flex justify-end">
                  {folder.key === "TRASH" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete permanently"
                      onClick={() => void deletePermanent(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NewFolderButton({
  onCreate,
  label,
}: {
  onCreate: (name: string) => Promise<void>;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error("Folder-ийн нэрээ оруулна уу");
      return;
    }
    setBusy(true);
    try {
      await onCreate(name.trim());
      toast.success(`"${name}" үүсгэлээ`);
      setOpen(false);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setName("");
      }}
    >
      <Button
        className="bg-primary text-primary-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" /> New folder
      </Button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            New folder in {label}
          </DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="pname">Folder-ийн нэр</Label>
          <Input
            id="pname"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="Жишээ: 2026 төсөл"
            className="mt-1.5"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={create}
            disabled={busy}
            className="bg-primary text-primary-foreground"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
