"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, ChevronRight, FileText, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { PROJECTS_CHANGED_EVENT } from "@/hooks/use-project-folders";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JobDialog } from "@/components/jobs/job-dialog";
import {
  JOB_STAGES,
  JOB_STAGE_LABELS,
  JOB_TYPE_META,
  overdueDays,
  type JobStage,
  type JobType,
} from "@/lib/jobs";
import type { ApiUserSummary, ProjectRole } from "@/types/domain";

// ─── Ажлын самбар ─────────────────────────────────────────────────────────────
// Ажил = jobStage-тэй төсөл. Карт чирж шатыг солино (утсан дээр — сонголтоор).
// Картыг дарвал тухайн төслийн файлууд руу орно.

type Job = {
  id: string;
  name: string;
  jobStage: JobStage;
  jobType: JobType | null;
  jobClient: string | null;
  jobDueDate: string | null;
  jobDeliveredAt: string | null;
  members: Array<{ role: ProjectRole; user: ApiUserSummary }>;
  _count: { files: number };
};

const AVATAR_COLORS = ["#0f766e", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#15803d"];

export default function JobsBoardPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [mine, setMine] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<JobStage | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs${mine ? "?mine=1" : ""}`);
      const data = (await res.json().catch(() => null)) as { jobs?: Job[]; message?: string } | null;
      if (!res.ok) throw new Error(data?.message ?? "Ажлуудыг ачаалж чадсангүй.");
      setJobs(data?.jobs ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      setJobs([]);
    }
  }, [mine]);

  useEffect(() => {
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onChange = () => void load();
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChange);
  }, [load]);

  const clients = useMemo(
    () => [...new Set((jobs ?? []).map((j) => j.jobClient).filter(Boolean) as string[])].sort(),
    [jobs],
  );

  async function moveTo(job: Job, stage: JobStage) {
    if (job.jobStage === stage) return;
    const previous = jobs;
    // Шууд шилжүүлж харуулна, алдаа гарвал буцаана
    setJobs((list) => list?.map((j) => (j.id === job.id ? { ...j, jobStage: stage } : j)) ?? null);
    const res = await fetch(`/api/projects/${job.id}/job`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      toast.error(body?.message ?? "Шилжүүлж чадсангүй.");
      setJobs(previous);
      return;
    }
    const data = (await res.json()) as { job: Job };
    setJobs((list) => list?.map((j) => (j.id === job.id ? data.job : j)) ?? null);
  }

  const activeCount = jobs?.filter((j) => j.jobStage !== "DELIVERED").length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-1.5 font-sans text-lg md:text-xl">
          <Link href="/dashboard/tools" className="text-muted-foreground hover:text-foreground">
            Хэрэгслүүд
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          Ажлын самбар
        </h1>
        {jobs && <span className="text-xs text-muted-foreground">{activeCount} идэвхтэй</span>}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full bg-muted p-0.5 text-xs">
            {[
              [false, "Бүгд"],
              [true, "Миний ажил"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setMine(value as boolean)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  mine === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
          <Button size="sm" className="rounded-full bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Ажил
          </Button>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-x-auto pb-2">
        <div className="grid h-full min-h-[60vh] grid-cols-[repeat(5,minmax(190px,1fr))] gap-3">
          {JOB_STAGES.map((stage) => {
            const items = (jobs ?? []).filter((j) => j.jobStage === stage);
            return (
              <section
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const job = jobs?.find((j) => j.id === dragId);
                  setOverStage(null);
                  setDragId(null);
                  if (job) void moveTo(job, stage);
                }}
                className={`flex min-h-0 flex-col gap-2 rounded-xl p-2.5 transition-colors ${
                  overStage === stage ? "bg-accent ring-2 ring-teal/40" : "bg-muted/60"
                }`}
              >
                <h2 className="flex items-center justify-between px-1 pb-0.5 font-sans text-xs font-medium text-muted-foreground">
                  {JOB_STAGE_LABELS[stage]}
                  <span>{items.length}</span>
                </h2>
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {!jobs ? (
                    <Skeleton className="h-20 rounded-lg" />
                  ) : (
                    items.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        meId={user?.id}
                        dragging={dragId === job.id}
                        onDragStart={() => setDragId(job.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        onMove={(s) => void moveTo(job, s)}
                      />
                    ))
                  )}
                  {jobs && items.length === 0 && stage === "ORDER" && (
                    <button
                      type="button"
                      onClick={() => setDialogOpen(true)}
                      className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground hover:bg-card"
                    >
                      ＋ Шинэ ажил нэмэх
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {dialogOpen && (
        <JobDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode={{ kind: "create" }}
          clientSuggestions={clients}
        />
      )}
    </div>
  );
}

function JobCard({
  job,
  meId,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  job: Job;
  meId?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stage: JobStage) => void;
}) {
  const late = overdueDays(job);
  const type = job.jobType ? JOB_TYPE_META[job.jobType] : null;
  const delivered = job.jobStage === "DELIVERED";
  const people = job.members.slice(0, 3);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-lg border border-border bg-card p-2.5 shadow-sm transition ${
        dragging ? "opacity-40" : "hover:border-teal/40"
      } ${delivered ? "opacity-75" : ""} cursor-grab active:cursor-grabbing`}
    >
      <Link href={`/dashboard/project?projectId=${job.id}`} className="block" draggable={false}>
        {type && (
          <span className={`inline-block rounded px-1.5 py-px text-[10.5px] font-medium ${type.className}`}>
            {type.label}
          </span>
        )}
        <div className="mt-1 text-[13px] font-medium leading-snug text-foreground">{job.name}</div>
        {job.jobClient && <div className="truncate text-xs text-muted-foreground">{job.jobClient}</div>}
      </Link>
      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        {delivered ? (
          <span className="text-green-700">
            ✓ {job.jobDeliveredAt ? format(new Date(job.jobDeliveredAt), "MM.dd") : "Хүлээлгэн өгсөн"}
          </span>
        ) : late > 0 ? (
          <span className="font-medium text-destructive">⚠ {late} хоног хоцорсон</span>
        ) : job.jobDueDate ? (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {format(new Date(job.jobDueDate), "MM.dd")}
          </span>
        ) : null}
        {job._count.files > 0 && (
          <span className="flex items-center gap-0.5">
            <FileText className="h-3 w-3" />
            {job._count.files}
          </span>
        )}
        <span className="ml-auto flex">
          {people.map((m, i) => {
            const label = (m.user.nickname || m.user.email || "?").charAt(0).toUpperCase();
            return (
              <span
                key={m.user.id}
                title={m.user.nickname || m.user.email}
                className={`-ml-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card text-[9px] font-bold text-white first:ml-0 ${
                  m.user.id === meId ? "ring-1 ring-teal" : ""
                }`}
                style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {label}
              </span>
            );
          })}
        </span>
      </div>
      {/* Утсан дээр чирэх боломжгүй тул шатыг сонголтоор солино */}
      <select
        value={job.jobStage}
        onChange={(e) => onMove(e.target.value as JobStage)}
        className="mt-2 h-7 w-full rounded-md border border-border bg-background px-2 text-xs md:hidden"
        aria-label="Шат солих"
      >
        {JOB_STAGES.map((s) => (
          <option key={s} value={s}>
            {JOB_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
