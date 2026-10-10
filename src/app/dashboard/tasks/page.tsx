"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton } from "@/components/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiTask, TaskStatus } from "@/types/domain";
import { CalendarDays, ClipboardList, Loader2, Trash2 } from "lucide-react";

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Хийх",
  IN_PROGRESS: "Хийгдэж буй",
  IN_REVIEW: "Хянагдаж буй",
  DONE: "Дууссан",
};

const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const PRIORITY_META = {
  URGENT: { label: "Яаралтай", className: "bg-destructive/15 text-destructive" },
  HIGH: { label: "Өндөр", className: "bg-orange-500/15 text-orange-600" },
  MEDIUM: { label: "Дунд", className: "bg-teal/15 text-teal" },
  LOW: { label: "Бага", className: "bg-muted text-muted-foreground" },
} as const;

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [onlyMine, setOnlyMine] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = (await res.json().catch(() => null)) as
        | { tasks?: ApiTask[]; message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Даалгавар уншиж чадсангүй.");
      setTasks(data?.tasks ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function changeStatus(task: ApiTask, status: TaskStatus) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      toast.error(body?.message ?? "Төлөв өөрчилж чадсангүй.");
      return;
    }
    toast.success(`"${task.title}" → ${STATUS_LABELS[status]}`);
    await load();
  }

  async function remove(task: ApiTask) {
    if (!window.confirm(`"${task.title}" даалгаврыг устгах уу?`)) return;
    setDeletingId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        toast.error(body?.message ?? "Устгаж чадсангүй.");
        return;
      }
      toast.success("Даалгавар устгагдлаа.");
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  const isAdmin = user?.role === "ADMIN";
  const visible = onlyMine ? tasks.filter((t) => t.assignee?.id === user?.id) : tasks;

  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 font-sans text-lg md:text-xl">
          <ClipboardList className="h-5 w-5 text-teal" />
          Даалгавар
        </h1>
        <div className="ml-auto flex rounded-full bg-muted p-0.5 text-xs">
          {[
            [true, "Надад оноогдсон"],
            [false, "Бүгд"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setOnlyMine(value as boolean)}
              className={`rounded-full px-3 py-1 transition-colors ${
                onlyMine === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <ListRowsSkeleton rows={5} />
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-14 text-center text-sm text-muted-foreground">
          <ClipboardList className="h-5 w-5" />
          {onlyMine ? "Танд оноогдсон даалгавар алга." : "Даалгавар алга."}
          <span className="text-xs">
            Шинэ даалгаврыг зүүн дээд талын “＋ Шинэ” → “Даалгавар”-аар үүсгэнэ.
          </span>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {STATUS_ORDER.map((status) => {
            const items = visible.filter((t) => t.status === status);
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="px-1 font-sans text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {STATUS_LABELS[status]} · {items.length}
                </h2>
                <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
                  {items.map((task) => {
                    const priority =
                      PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIUM;
                    const canDelete = isAdmin || task.creator?.id === user?.id;
                    const overdue =
                      task.dueDate &&
                      task.status !== "DONE" &&
                      isPast(new Date(task.dueDate));
                    return (
                      <div
                        key={task.id}
                        className="flex min-w-0 items-center gap-2 border-b border-border/60 px-3 py-2.5 text-sm last:border-b-0 sm:gap-3 sm:px-3.5"
                      >
                        <span
                          className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-block ${priority.className}`}
                        >
                          {priority.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">
                            {/* Утсан дээр зэрэглэлийг жижиг өнгөт шошгоор */}
                            <span
                              className={`mr-1.5 inline-block rounded-full px-1.5 align-middle text-[9px] sm:hidden ${priority.className}`}
                            >
                              {priority.label}
                            </span>
                            {task.title}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {task.dueDate && (
                              <span className={`sm:hidden ${overdue ? "font-medium text-destructive" : ""}`}>
                                {format(new Date(task.dueDate), "MM.dd")} ·{" "}
                              </span>
                            )}
                            {task.project?.name}
                            {task.assignee &&
                              ` · ${task.assignee.nickname || task.assignee.email}`}
                            {task.description ? ` · ${task.description}` : ""}
                          </div>
                        </div>
                        {task.dueDate && (
                          <span
                            className={`hidden shrink-0 items-center gap-1 text-xs sm:flex ${
                              overdue ? "font-medium text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            <CalendarDays className="size-3.5" />
                            {format(new Date(task.dueDate), "MM.dd")}
                          </span>
                        )}
                        <Select
                          value={task.status}
                          onValueChange={(v) =>
                            void changeStatus(task, v as TaskStatus)
                          }
                        >
                          <SelectTrigger className="h-8 w-28 shrink-0 text-xs sm:w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {canDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          title="Устгах"
                          disabled={deletingId === task.id}
                          onClick={() => void remove(task)}
                        >
                          {deletingId === task.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                        ) : (
                          <span className="w-8 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
