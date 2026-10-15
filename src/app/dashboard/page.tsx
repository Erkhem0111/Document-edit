"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, format } from "date-fns";
import { mn } from "date-fns/locale";
import { ArrowRight, CalendarClock, ClipboardList, FileText, Plus } from "lucide-react";
import { TaskDialog } from "@/components/project/task-dialog";
import { useAuth } from "@/hooks/use-auth";
import { FileTypeIcon } from "@/components/file/file-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiTask } from "@/types/domain";

// ─── Нүүр ─────────────────────────────────────────────────────────────────────
// "Үргэлжлүүлж ажиллах" зүйлс: сүүлд өөрчлөгдсөн файлууд, миний даалгавар.
// Файл үүсгэх нь зүүн талын "Шинэ"-д; даалгаврыг энд шууд нэмж болно.

type RecentFile = {
  id: string;
  name: string;
  mimeType: string;
  projectId: string;
  updatedAt: string;
  project: { name: string };
  uploader?: { nickname?: string | null; email: string };
};

const RECENT_LIMIT = 8;

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
  const { user } = useAuth();
  const recent = useJson<{ files: RecentFile[] }>("/api/files/recent");
  const tasks = useJson<{ tasks: ApiTask[] }>("/api/tasks");
  const [taskOpen, setTaskOpen] = useState(false);

  const myTasks = (tasks?.tasks ?? [])
    .filter((t) => t.status !== "DONE" && t.assignee?.id === user?.id)
    .sort((a, b) => {
      // Хугацаатай нь эхэнд, ойрхон хугацаа нь түрүүнд
      const da = a.dueDate ? +new Date(a.dueDate) : Infinity;
      const db = b.dueDate ? +new Date(b.dueDate) : Infinity;
      return da - db;
    })
    .slice(0, RECENT_LIMIT);

  const firstName = user?.name || user?.email?.split("@")[0] || "";
  const files = (recent?.files ?? []).slice(0, RECENT_LIMIT);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-2xl text-primary md:text-3xl">
        Сайн байна уу{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {format(new Date(), "yyyy.MM.dd")} · Сүүлд ажилласан файлууд болон танд оноогдсон даалгавар
      </p>

      {/* Хоёр багана ижил өндөртэй — богино нь доошоо сунаж, хоосон зай үлдэхгүй */}
      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          icon={<FileText className="h-4 w-4 text-teal" />}
          title="Сүүлд өөрчлөгдсөн"
        >
          {!recent ? (
            <RowsSkeleton rows={RECENT_LIMIT} />
          ) : files.length === 0 ? (
            <Empty icon={<FileText className="h-5 w-5" />}>
              Одоохондоо файл алга. Зүүн талын “Шинэ” товчоор эхлээрэй.
            </Empty>
          ) : (
            files.map((file) => (
              <Link
                key={file.id}
                href={`/dashboard/file?folderId=${file.projectId}&fileId=${file.id}`}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent/50"
              >
                <FileTypeIcon name={file.name} mimeType={file.mimeType} />
                <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                <span className="hidden max-w-40 shrink-0 truncate text-xs text-muted-foreground sm:block">
                  {file.project.name}
                </span>
                <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(file.updatedAt), {
                    addSuffix: true,
                    locale: mn,
                  })}
                </span>
              </Link>
            ))
          )}
        </Panel>

        <Panel
          icon={<ClipboardList className="h-4 w-4 text-teal" />}
          title="Миний даалгавар"
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTaskOpen(true)}
                title="Шинэ даалгавар"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Нэмэх
              </button>
              <Link
                href="/dashboard/tasks"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Бүгд <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          }
        >
          {!tasks ? (
            <RowsSkeleton rows={4} />
          ) : myTasks.length === 0 ? (
            <Empty icon={<ClipboardList className="h-5 w-5" />}>
              Танд хийх даалгавар алга.
              <button
                type="button"
                onClick={() => setTaskOpen(true)}
                className="mt-1 text-xs font-medium text-teal hover:underline"
              >
                + Даалгавар нэмэх
              </button>
            </Empty>
          ) : (
            myTasks.map((task) => {
              const overdue =
                task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
              return (
                <Link
                  key={task.id}
                  href="/dashboard/tasks"
                  className="flex items-start gap-3 border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0 hover:bg-accent/50"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-slate-300"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">{task.title}</div>
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
        </Panel>
      </div>

      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </div>
  );
}

// Толгой нь картын дотор — хоёр багана яг ижил хүрээтэй харагдана
function Panel({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        {icon}
        <h2 className="font-sans text-sm font-medium text-foreground">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Empty({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border/60 px-3.5 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-3" style={{ width: `${55 - (i % 3) * 12}%` }} />
        </div>
      ))}
    </div>
  );
}
