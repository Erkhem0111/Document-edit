"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict, format } from "date-fns";
import { mn } from "date-fns/locale";
import { ArrowRight, CalendarClock, ClipboardList, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { FileTypeIcon } from "@/components/file/file-type-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiTask } from "@/types/domain";

// ─── Нүүр ─────────────────────────────────────────────────────────────────────
// Үүсгэх үйлдлүүд зүүн талын "＋ Шинэ"-д байгаа тул энд давхар товч байхгүй.
// Зөвхөн "үргэлжлүүлж ажиллах" зүйлс: сүүлд өөрчлөгдсөн файлууд, миний даалгавар.

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
  const { user } = useAuth();
  const recent = useJson<{ files: RecentFile[] }>("/api/files/recent");
  const tasks = useJson<{ tasks: ApiTask[] }>("/api/tasks");

  const myTasks = (tasks?.tasks ?? [])
    .filter((t) => t.status !== "DONE" && t.assignee?.id === user?.id)
    .sort((a, b) => {
      // Хугацаатай нь эхэнд, ойрхон хугацаа нь түрүүнд
      const da = a.dueDate ? +new Date(a.dueDate) : Infinity;
      const db = b.dueDate ? +new Date(b.dueDate) : Infinity;
      return da - db;
    })
    .slice(0, 6);

  const firstName = user?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-2xl text-primary md:text-3xl">
        Сайн байна уу{firstName ? `, ${firstName}` : ""}
      </h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Сүүлд өөрчлөгдсөн файлууд */}
        <section className="min-w-0">
          <h2 className="mb-2 font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Сүүлд өөрчлөгдсөн
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {!recent ? (
              <RowsSkeleton />
            ) : recent.files.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-muted-foreground">
                <FileText className="h-5 w-5" />
                Одоохондоо файл алга. Зүүн дээд буланд байгаа “＋ Шинэ” товчоор эхлээрэй.
              </div>
            ) : (
              recent.files.map((file) => (
                <Link
                  key={file.id}
                  href={`/dashboard/file?folderId=${file.projectId}&fileId=${file.id}`}
                  className="flex items-center gap-3 border-b border-border/60 px-3.5 py-2 text-sm transition-colors last:border-b-0 hover:bg-accent/50"
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
          </div>
        </section>

        {/* Миний даалгавар */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center">
            <h2 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Миний даалгавар
            </h2>
            <Link
              href="/dashboard/tasks"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              Бүгд <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
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
                    className="flex items-start gap-3 border-b border-border/60 px-3.5 py-2.5 text-sm last:border-b-0 hover:bg-accent/50"
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
          </div>
        </section>
      </div>
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
