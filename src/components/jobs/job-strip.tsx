"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ChevronRight, Pencil } from "lucide-react";
import { JobDialog } from "@/components/jobs/job-dialog";
import { notifyProjectsChanged } from "@/hooks/use-project-folders";
import { JOB_STAGES, JOB_STAGE_SHORT, JOB_TYPE_META, overdueDays, type JobStage } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import type { ApiProject } from "@/types/domain";

// ─── Төслийн хуудасны нимгэн "ажлын мөр" ──────────────────────────────────────
// Ажлын мэдээлэлтэй төсөл дээр л харагдана. Шат дээр дарж шилжүүлнэ
// (самбар дээр чирэхтэй адил), ✎ дарж засна.

export function JobStrip({
  project,
  canEdit,
  canRemove,
  onChanged,
}: {
  project: ApiProject;
  canEdit: boolean;
  canRemove: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!project.jobStage) return null;

  const type = project.jobType ? JOB_TYPE_META[project.jobType] : null;
  const late = overdueDays(project);
  const current = JOB_STAGES.indexOf(project.jobStage);

  async function setStage(stage: JobStage) {
    if (!canEdit || busy || stage === project.jobStage) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/job`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Шат солиж чадсангүй.");
      }
      await onChanged();
      notifyProjectsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Шат солиж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        {type && <span className={`rounded px-1.5 py-px text-[11px] font-medium ${type.className}`}>{type.label}</span>}
        {project.jobClient && (
          <span>
            <span className="text-muted-foreground">Захиалагч </span>
            {project.jobClient}
          </span>
        )}
        {project.jobDueDate && (
          <span className={late > 0 ? "font-medium text-destructive" : ""}>
            <span className={late > 0 ? "" : "text-muted-foreground"}>Хугацаа </span>
            {format(new Date(project.jobDueDate), "yyyy.MM.dd")}
            {late > 0 && ` · ${late} хоног хоцорсон`}
          </span>
        )}
        <span className="flex flex-wrap items-center gap-0.5">
          {JOB_STAGES.map((stage, i) => (
            <span key={stage} className="flex items-center">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => void setStage(stage)}
                title={canEdit ? `“${JOB_STAGE_SHORT[stage]}” шат руу шилжүүлэх` : undefined}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                  i === current
                    ? "bg-teal font-medium text-white"
                    : i < current
                      ? "text-teal"
                      : "bg-muted text-muted-foreground",
                  canEdit && i !== current && "hover:bg-accent hover:text-foreground",
                )}
              >
                {i < current ? "✓ " : ""}
                {JOB_STAGE_SHORT[stage]}
              </button>
            </span>
          ))}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Засах
          </button>
        )}
      </div>
      {editOpen && (
        <JobDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode={{ kind: "edit", project, canRemove }}
          onSaved={() => void onChanged()}
        />
      )}
    </>
  );
}
