"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2, LogIn, Plus, Users } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  initialTab = "create",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "create" | "join";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">(initialTab);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("SHARED");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    onOpenChange(false);
    setName("");
    setCode("");
    setTab(initialTab);
  }

  async function submit(url: string, body: unknown, success: string) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: { id: string }; message?: string }
        | null;
      if (!res.ok || !data?.project) {
        throw new Error(data?.message ?? "Алдаа гарлаа.");
      }
      toast.success(success);
      notifyProjectsChanged();
      close();
      router.push(`/dashboard/project?projectId=${data.project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Төслийн нэрээ оруулна уу");
      return;
    }
    void submit("/api/projects", { name: trimmed, visibility }, "Төсөл үүслээ");
  }

  function join() {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Кодоо оруулна уу");
      return;
    }
    void submit("/api/projects/join", { code: trimmed }, "Төсөлд нэгдлээ");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            Төсөл
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "create" | "join")}>
          <TabsList className="w-full">
            <TabsTrigger value="create">Шинэ төсөл</TabsTrigger>
            <TabsTrigger value="join">Кодоор нэгдэх</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="new-project-name">Нэр</Label>
              <Input
                id="new-project-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
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
                        selected
                          ? "border-teal bg-accent"
                          : "border-border hover:bg-accent/50"
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
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Болих
              </Button>
              <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={create}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Үүсгэх
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="join" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Хамт ажиллагчийн өгсөн урих кодыг оруулна.
            </p>
            <div>
              <Label htmlFor="join-code">Урих код</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") join();
                }}
                placeholder="Жишээ: AB7K2QMN"
                className="mt-1.5 font-mono tracking-widest"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Болих
              </Button>
              <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={join}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Нэгдэх
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
