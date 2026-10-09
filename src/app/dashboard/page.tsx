"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNowStrict, format } from "date-fns";
import { mn } from "date-fns/locale";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FilePlus,
  FileText,
  FolderPlus,
  Loader2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCreateDocument } from "@/hooks/use-create-document";
import {
  notifyProjectsChanged,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import { getFolder, getProjectFolderKey } from "@/lib/folders";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiTask } from "@/types/domain";

// ─── Нүүр хуудас ──────────────────────────────────────────────────────────────
// Нэвтэрмэгц хамгийн их хэрэгтэй зүйлс: шинэ баримт / файл оруулах товч,
// сүүлд өөрчлөгдсөн файлууд, надад оноогдсон даалгавар, төслүүд.

type RecentFile = {
  id: string;
  name: string;
  mimeType: string;
  projectId: string;
  updatedAt: string;
  project: { name: string };
  uploader?: { nickname?: string | null; email: string };
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-slate-300",
};

function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (res.ok) setData((await res.json()) as T);
    } catch {
      // нүүр хуудасны блок заавал биш — алдааг чимээгүй өнгөрөөнө
    }
  }, [url]);
  useEffect(() => {
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return data;
}

export default function DashboardHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createDocument, creating } = useCreateDocument();
  const { projects, loading: projectsLoading } = useProjectFolders();
  const recent = useJson<{ files: RecentFile[] }>("/api/files/recent");
  const tasks = useJson<{ tasks: ApiTask[] }>("/api/tasks");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const myTasks = (tasks?.tasks ?? [])
    .filter((t) => t.status !== "DONE" && t.assignee?.id === user?.id)
    .sort((a, b) => {
      // Хугацаатай нь эхэнд, ойрхон хугацаа нь түрүүнд
      const da = a.dueDate ? +new Date(a.dueDate) : Infinity;
      const db = b.dueDate ? +new Date(b.dueDate) : Infinity;
      return da - db;
    })
    .slice(0, 5);

  const activeProjects = projects
    .filter((p) => {
      const key = getProjectFolderKey(p);
      return key !== "ARCHIVE" && key !== "TRASH";
    })
    .slice(0, 6);

  // Төсөл сонгохгүйгээр "Миний баримтууд" руу файл оруулна
  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    const tooBig = files.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" хэтэрхий том байна (дээд тал нь 50MB).`);
      return;
    }
    setUploading(true);
    try {
      const ws = await fetch("/api/workspace/personal", { method: "POST" });
      const { projectId } = (await ws.json()) as { projectId: string };
      let lastFileId: string | null = null;
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => null)) as
          | { file?: { id: string }; message?: string }
          | null;
        if (!res.ok) throw new Error(data?.message ?? `"${file.name}" оруулж чадсангүй.`);
        lastFileId = data?.file?.id ?? null;
      }
      notifyProjectsChanged();
      toast.success(
        files.length === 1 ? "Файл орлоо" : `${files.length} файл орлоо`,
      );
      // Нэг файл бол шууд нээнэ, олон бол хадгалсан төслийг нээнэ
      router.push(
        files.length === 1 && lastFileId
          ? `/dashboard/file?folderId=${projectId}&fileId=${lastFileId}`
          : `/dashboard/project?projectId=${projectId}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Файл оруулж чадсангүй.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const firstName = user?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="px-4 py-6 md:px-10 md:py-10">
      <p className="text-xs uppercase tracking-[0.25em] text-teal">Workspace</p>
      <h1 className="mt-1 font-display text-3xl text-primary md:text-4xl">
        Сайн байна уу{firstName ? `, ${firstName}` : ""}
      </h1>

      {/* Хурдан үйлдлүүд */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickAction
          icon={creating ? Loader2 : FilePlus}
          spinning={creating}
          title="Шинэ баримт"
          hint="Хоосон баримт нээж шууд бичнэ"
          primary
          onClick={() => void createDocument()}
        />
        <QuickAction
          icon={uploading ? Loader2 : Upload}
          spinning={uploading}
          title="Файл оруулах"
          hint="PDF, зураг, Word, Excel…"
          onClick={() => fileInputRef.current?.click()}
        />
        <QuickAction
          icon={FolderPlus}
          title="Шинэ төсөл"
          hint="Багтайгаа хамтран ажиллах"
          onClick={() => setNewProjectOpen(true)}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Сүүлд өөрчлөгдсөн файлууд */}
        <section className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">Сүүлд өөрчлөгдсөн</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {!recent ? (
              <RowsSkeleton />
            ) : recent.files.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Файл алга. Дээрх товчоор эхний баримтаа үүсгээрэй.
              </p>
            ) : (
              recent.files.map((file) => (
                <Link
                  key={file.id}
                  href={`/dashboard/file?folderId=${file.projectId}&fileId=${file.id}`}
                  className="flex items-center gap-3 border-b border-border/60 px-4 py-3 text-sm transition last:border-b-0 hover:bg-accent/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-teal">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{file.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {file.project.name} ·{" "}
                      {formatDistanceToNowStrict(new Date(file.updatedAt), {
                        addSuffix: true,
                        locale: mn,
                      })}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Надад оноогдсон даалгавар */}
        <section className="min-w-0">
          <div className="flex items-center">
            <h2 className="text-sm font-medium text-foreground">Миний даалгавар</h2>
            <Link
              href="/dashboard/tasks"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              Бүгд <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {!tasks ? (
              <RowsSkeleton rows={3} />
            ) : myTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted-foreground">
                <ClipboardList className="h-5 w-5" />
                Танд хийх даалгавар алга.
              </div>
            ) : (
              myTasks.map((task) => {
                const overdue =
                  task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
                return (
                  <Link
                    key={task.id}
                    href="/dashboard/tasks"
                    className="flex items-start gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-b-0 hover:bg-accent/40"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-slate-300"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{task.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {task.project?.name}
                      </div>
                    </div>
                    {task.dueDate && (
                      <span
                        className={`flex shrink-0 items-center gap-1 text-xs ${
                          overdue ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {format(new Date(task.dueDate), "MM/dd")}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Төслүүд */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-foreground">Төслүүд</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projectsLoading && activeProjects.length === 0
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            : activeProjects.map((project) => {
                const folder = getFolder(getProjectFolderKey(project));
                const Icon = folder?.icon ?? FileText;
                return (
                  <Link
                    key={project.id}
                    href={`/dashboard/project?projectId=${project.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${folder?.color ?? "#0f766e"} 16%, transparent)`,
                        color: folder?.color,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {project.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {project._count?.files ?? 0} файл · {folder?.label}
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </section>

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  hint,
  onClick,
  primary = false,
  spinning = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
  spinning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={spinning}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card disabled:opacity-70 ${
        primary
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          primary ? "bg-white/15" : "bg-accent text-teal"
        }`}
      >
        <Icon className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className={`text-xs ${primary ? "opacity-80" : "text-muted-foreground"}`}>
          {hint}
        </div>
      </div>
    </button>
  );
}

function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: `${60 - (i % 3) * 12}%` }} />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
