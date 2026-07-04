"use client";

import { useState } from "react";
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
import type { ApiProject, TaskPriority } from "@/types/domain";
import { ClipboardList, Loader2 } from "lucide-react";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Бага",
  MEDIUM: "Дунд",
  HIGH: "Өндөр",
  URGENT: "Яаралтай",
};

// Төслийн гишүүнд даалгавар оноох dialog.
// Үүссэн даалгавар /dashboard/tasks дээр харагдана.
export function TaskDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ApiProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const members = (project.members ?? []).filter((m) => m.user);

  async function create() {
    if (!title.trim()) {
      toast.error("Даалгаврын нэрээ оруулна уу");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
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
      router.push("/dashboard/tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            <ClipboardList className="mr-2 inline size-5" />
            Шинэ даалгавар
          </DialogTitle>
        </DialogHeader>

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
            Cancel
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
