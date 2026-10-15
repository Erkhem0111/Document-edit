"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Users } from "lucide-react";
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
import { PeoplePicker, type DirectoryUser } from "@/components/people/people-picker";
import { useAuth } from "@/hooks/use-auth";
import { notifyProjectsChanged } from "@/hooks/use-project-folders";
import type { ProjectVisibility } from "@/types/domain";

// Шинэ төсөл "Төслүүд"-д үүснэ. Хэн харахыг энгийн үгээр сонгоно:
// урьсан хүмүүс (SHARED) эсвэл компанийн бүх хүн (PUBLIC). Хувийн файл
// "Миний файлууд"-д, компанийн материал "Компанийн сан"-д байдаг тул энд сонголтгүй.
const ACCESS_OPTIONS: Array<{ key: ProjectVisibility; title: string; hint: string; icon: typeof Users }> = [
  { key: "SHARED", title: "Урьсан хүмүүс", hint: "Зөвхөн нэмсэн гишүүд", icon: Users },
  { key: "PUBLIC", title: "Компанийн бүх хүн", hint: "Бүгд харна, гишүүд засна", icon: Building2 },
];

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("SHARED");
  // Урих кодын оронд гишүүдийг шууд нэмнэ (заавал биш)
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  function close() {
    onOpenChange(false);
    setName("");
    setPeople([]);
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Төслийн нэрээ оруулна уу");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, visibility }),
      });
      const data = (await res.json().catch(() => null)) as { project?: { id: string }; message?: string } | null;
      if (!res.ok || !data?.project) throw new Error(data?.message ?? "Алдаа гарлаа.");
      const projectId = data.project.id;
      // Сонгосон хүмүүсийг засах эрхтэй нэмнэ (имэйлээр мэдэгдэнэ)
      const failed: string[] = [];
      for (const person of people) {
        const r = await fetch(`/api/projects/${projectId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: person.email, role: "EDITOR" }),
        }).catch(() => null);
        if (!r?.ok) failed.push(person.nickname || person.email);
      }
      if (failed.length > 0) toast.error(`Нэмж чадсангүй: ${failed.join(", ")}`);
      toast.success(people.length > failed.length ? "Төсөл үүсэж, гишүүд нэмэгдлээ" : "Төсөл үүслээ");
      notifyProjectsChanged();
      close();
      router.push(`/dashboard/project?projectId=${projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans text-lg">Шинэ төсөл</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="new-project-name">Нэр</Label>
            <Input
              id="new-project-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              placeholder="Жишээ: Сүхбаатар дүүргийн хэмжилт"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Хэн харах вэ?</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {ACCESS_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = visibility === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setVisibility(option.key)}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 text-left transition ${
                      selected ? "border-teal bg-accent" : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                    <span>
                      <span className="block text-sm font-medium">{option.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>
              Гишүүд <span className="font-normal text-muted-foreground">(заавал биш — дараа нь ч нэмж болно)</span>
            </Label>
            <div className="mt-1.5">
              <PeoplePicker
                value={people}
                onChange={setPeople}
                excludeIds={user?.id ? [user.id] : []}
                placeholder="Нэр эсвэл имэйлээр хайх"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Болих
          </Button>
          <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void create()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Үүсгэх
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
