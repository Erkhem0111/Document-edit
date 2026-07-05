"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiTask, TaskStatus } from "@/types/domain";
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Loader2,
  Trash2,
} from "lucide-react";

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
  const [tasks, setTasks] = useState<ApiTask[]>([]);
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
    void load();
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

  return (
    <div className="px-5 py-6 md:px-10 md:py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Workspace
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-teal">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-4xl text-primary">Даалгавар</h1>
          <p className="text-sm text-muted-foreground">
            Таны гишүүн бүх төслийн даалгаврууд. Шинэ даалгаврыг төслийн
            хуудасны <b>Task</b> товчоор үүсгэнэ.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Даалгавар алга. Төслийн хуудаснаас шинээр үүсгээрэй.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {STATUS_ORDER.map((status) => {
            const items = tasks.filter((t) => t.status === status);
            if (items.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="px-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                  {STATUS_LABELS[status]} · {items.length}
                </h2>
                <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                  {items.map((task) => {
                    const priority =
                      PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIUM;
                    const overdue =
                      task.dueDate &&
                      task.status !== "DONE" &&
                      isPast(new Date(task.dueDate));
                    return (
                      <div
                        key={task.id}
                        className="flex min-w-0 items-center gap-3 border-b border-border/60 px-5 py-3 text-sm last:border-b-0"
                      >
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${priority.className}`}
                        >
                          {priority.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">
                            {task.title}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {task.project?.name}
                            {task.assignee &&
                              ` · ${task.assignee.nickname || task.assignee.email}`}
                            {task.description ? ` · ${task.description}` : ""}
                          </div>
                        </div>
                        {task.dueDate && (
                          <span
                            className={`flex shrink-0 items-center gap-1 text-xs ${
                              overdue ? "font-medium text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            <CalendarDays className="size-3.5" />
                            {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        )}
                        <Select
                          value={task.status}
                          onValueChange={(v) =>
                            void changeStatus(task, v as TaskStatus)
                          }
                        >
                          <SelectTrigger className="w-36 shrink-0">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          title="Устгах (зөвхөн төслийн эзэн)"
                          disabled={deletingId === task.id}
                          onClick={() => void remove(task)}
                        >
                          {deletingId === task.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
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
