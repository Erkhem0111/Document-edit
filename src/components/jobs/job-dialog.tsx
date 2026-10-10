"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { notifyProjectsChanged, useProjectFolders } from "@/hooks/use-project-folders";
import { getProjectFolderKey } from "@/lib/folders";
import { JOB_TYPES, JOB_TYPE_META, type JobType } from "@/lib/jobs";
import type { ApiProject } from "@/types/domain";

// ─── Ажил үүсгэх / засах цонх ────────────────────────────────────────────────
// Заавал: нэр. Бусад нь (захиалагч, хугацаа, төрөл) хоосон байж болно —
// хүнийг саатуулахгүй, дараа нь нөхөж болно.
//   create — самбараас: шинэ төсөл эсвэл байгаа төсөлд холбоно
//   attach — төслийн хуудаснаас: тухайн төсөлд ажлын мэдээлэл нэмнэ
//   edit   — байгаа ажлын мэдээллийг засна

export type JobDialogMode =
  | { kind: "create" }
  | { kind: "attach"; project: ApiProject }
  | { kind: "edit"; project: ApiProject; canRemove: boolean };

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function JobDialog({
  open,
  onOpenChange,
  mode,
  clientSuggestions = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: JobDialogMode;
  clientSuggestions?: string[];
  onSaved?: () => void;
}) {
  const initial = mode.kind === "create" ? null : mode.project;
  const [name, setName] = useState(initial?.name ?? "");
  const [client, setClient] = useState(initial?.jobClient ?? "");
  const [dueDate, setDueDate] = useState(toDateInput(initial?.jobDueDate));
  const [type, setType] = useState<JobType>((initial?.jobType as JobType) ?? "CADASTRE");
  const [target, setTarget] = useState<string>(""); // "" = шинэ төсөл
  const [busy, setBusy] = useState(false);
  const { projects } = useProjectFolders();

  // Холбож болох төслүүд: хогийн саванд биш, Reference биш, ажилгүй, би засаж чадах
  const attachable =
    mode.kind === "create"
      ? projects.filter((p) => {
          const key = getProjectFolderKey(p);
          const role = p.members?.[0]?.role;
          return (
            key !== "TRASH" &&
            key !== "REFERENCE" &&
            !p.jobStage &&
            (role === "OWNER" || role === "EDITOR")
          );
        })
      : [];

  async function save() {
    const trimmed = name.trim();
    if (mode.kind !== "edit" && !trimmed && !target) {
      toast.error("Ажлын нэрээ бичнэ үү.");
      return;
    }
    setBusy(true);
    try {
      const payload = { name: trimmed, client, type, dueDate };
      const res =
        mode.kind === "edit"
          ? await fetch(`/api/projects/${mode.project.id}/job`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/jobs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                projectId: mode.kind === "attach" ? mode.project.id : target || undefined,
              }),
            });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Хадгалж чадсангүй.");
      }
      // Нэр өөрчлөгдсөн бол төслийн нэрийг ч шинэчилнэ (edit үед тусдаа)
      if (mode.kind === "edit" && trimmed && trimmed !== mode.project.name) {
        await fetch(`/api/projects/${mode.project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
      }
      toast.success(mode.kind === "edit" ? "Хадгалагдлаа" : "Ажил нэмэгдлээ");
      notifyProjectsChanged();
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (mode.kind !== "edit") return;
    if (!window.confirm("Ажлын мэдээллийг арилгах уу? Төсөл, файлууд хэвээр үлдэнэ.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${mode.project.id}/job`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Арилгаж чадсангүй.");
      }
      toast.success("Ажлын мэдээлэл арилгагдлаа");
      notifyProjectsChanged();
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Арилгаж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode.kind === "edit" ? "Ажлын мэдээлэл" : mode.kind === "attach" ? "Ажлын мэдээлэл нэмэх" : "Шинэ ажил";
  const showName = mode.kind !== "create" || !target;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans text-lg">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          {mode.kind === "create" && attachable.length > 0 && (
            <div>
              <Label htmlFor="job-target">Төсөл</Label>
              <select
                id="job-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">＋ Шинэ төсөл үүсгэх</option>
                {attachable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showName && (
            <div>
              <Label htmlFor="job-name">Нэр</Label>
              <Input
                id="job-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Жишээ: Баянзүрх 26-р хороо, газар өмчлөл"
                className="mt-1.5"
              />
            </div>
          )}

          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div>
              <Label htmlFor="job-client">Захиалагч</Label>
              <Input
                id="job-client"
                list="job-client-list"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Байгууллага / хүн"
                className="mt-1.5"
              />
              {/* Өмнө бичсэн захиалагчдаас санал болгоно — дахин бичихгүй */}
              <datalist id="job-client-list">
                {clientSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="job-due">Хугацаа</Label>
              <Input
                id="job-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Ажлын төрөл</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {JOB_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {JOB_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {mode.kind === "edit" && mode.canRemove ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => void remove()}>
              Ажлын мэдээлэл арилгах
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Болих
            </Button>
            <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void save()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode.kind === "edit" ? "Хадгалах" : "Нэмэх"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
