"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectSelect } from "@/components/project/project-select";
import { useAuth } from "@/hooks/use-auth";
import {
  notifyProjectsChanged,
  useProjectFolder,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import { getProjectFolderKey } from "@/lib/folders";
import type { ApiProject, TaskPriority } from "@/types/domain";
import { ClipboardList, Loader2 } from "lucide-react";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Бага",
  MEDIUM: "Дунд",
  HIGH: "Өндөр",
  URGENT: "Яаралтай",
};

// Даалгавар үүсгэх dialog. Даалгавар төсөлд харьяалагдана:
// төсөл дотроос нээвэл тэр төсөлд, бусад газраас нээвэл төслөө сонгоно
// (анхдагч нь "Миний файлууд" — өөртөө тэмдэглэл үлдээх).
// Үүссэн даалгавар /dashboard/tasks дээр харагдана.
export function TaskDialog({
  project: fixedProject,
  open,
  onOpenChange,
  onCreated,
}: {
  project?: ApiProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Өгөөгүй бол үүсгэсний дараа даалгаврын хуудас руу шилжинэ
  onCreated?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { projects } = useProjectFolders();
  const [pickedId, setPickedId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  // Даалгавар үүсгэж болох төслүүд (сервер дахин шалгана)
  const choices = projects.filter((p) => {
    const key = getProjectFolderKey(p);
    const myRole = p.members?.[0]?.role;
    if (key === "TRASH") return false;
    if (key === "PRIVATE") return myRole === "OWNER";
    if (user?.role === "ADMIN") return true;
    if (key === "REFERENCE") return myRole === "OWNER";
    return myRole === "OWNER" || myRole === "EDITOR";
  });
  const personal = choices.find((p) => getProjectFolderKey(p) === "PRIVATE");
  const projectId = fixedProject?.id ?? (pickedId || personal?.id || "");
  // Гишүүдийн жагсаалт зөвхөн төслийн дэлгэрэнгүйд ирнэ
  const { project: picked } = useProjectFolder(fixedProject ? "" : projectId);
  const project = fixedProject ?? picked;
  const members = (project?.members ?? []).filter((m) => m.user);

  // Шинэ хэрэглэгчид "Миний файлууд" хараахан үүсээгүй байж болно
  const needsPersonal = open && !fixedProject && projects.length > 0 && !personal;
  useEffect(() => {
    if (!needsPersonal) return;
    void fetch("/api/workspace/personal", { method: "POST" }).then((res) => {
      if (res.ok) notifyProjectsChanged();
    });
  }, [needsPersonal]);

  async function create() {
    if (!title.trim()) {
      toast.error("Даалгаврын нэрээ оруулна уу");
      return;
    }
    if (!projectId) {
      toast.error("Аль төсөлд хамаарахыг сонгоно уу");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || null,
          assigneeId: assigneeId || undefined,
          priority,
          dueDate: dueDate || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Даалгавар үүсгэж чадсангүй.");
      toast.success(`"${title.trim()}" даалгавар үүслээ`);
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("MEDIUM");
      setDueDate("");
      setPickedId("");
      if (onCreated) onCreated();
      else router.push("/dashboard/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            <ClipboardList className="mr-2 inline size-5" />
            Шинэ даалгавар
          </DialogTitle>
        </DialogHeader>

        {!fixedProject && (
          <div>
            <Label>Аль төсөлд</Label>
            <ProjectSelect
              projects={choices}
              value={projectId}
              onChange={(id) => {
                setPickedId(id);
                setAssigneeId("");
              }}
              placeholder="Төсөл сонгох"
            />
            {projectId && projectId === personal?.id && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Зөвхөн өөртөө. Бусдад оноох бол багийн төслөө сонгоно уу.
              </p>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="task-title">Нэр</Label>
          <Input
            id="task-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="Жишээ: Хэмжилтийн тайлан бэлтгэх"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="task-desc">Тайлбар (заавал биш)</Label>
          <Input
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="Нэмэлт дэлгэрэнгүй"
            className="mt-1.5"
          />
        </div>

        <div className="flex min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <Label>Хариуцагч</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Өөрөө" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.user!.id} value={member.user!.id}>
                    {member.user!.nickname || member.user!.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-28 shrink-0">
            <Label>Зэрэглэл</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as TaskPriority)}
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="task-due">Дуусах хугацаа (заавал биш)</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy}
            onClick={create}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ClipboardList className="mr-2 size-4" />
            )}
            Үүсгэх
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
