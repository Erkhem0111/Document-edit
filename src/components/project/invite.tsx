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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Copy, RefreshCw, LogIn, Loader2, Plus } from "lucide-react";

// ─── Owner: Shared folder-т урих код харуулах ─────────────────────────────────
export function InviteButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensureCode(rotate: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const data = (await res.json().catch(() => null)) as
        | { inviteCode?: string; message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Код авахад алдаа гарлаа.");
      setCode(data?.inviteCode ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  function openDialog() {
    setOpen(true);
    void ensureCode(false);
  }

  function copy() {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    toast.success("Код хууллаа");
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <UserPlus className="mr-2 h-4 w-4" /> Invite
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              Хүн урих
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Доорх кодыг өгвөл хэрэглэгч энэ Shared folder-т нэгдэнэ.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-border bg-muted px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-foreground">
              {loading ? "…" : (code ?? "—")}
            </div>
            <Button variant="outline" size="icon" title="Хуулах" onClick={copy}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Шинэ код үүсгэх"
              disabled={loading}
              onClick={() => ensureCode(true)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Шинэ код үүсгэвэл хуучин код ажиллахаа болино.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Shared folder: Create / Join хоёр tab ────────────────────────────────────
// Create → шинэ Shared folder үүсгэнэ (код автоматаар үүснэ), шууд орно.
// Join   → кодоор одоо байгаа Shared folder-т EDITOR болж нэгдэнэ.
export function SharedAccess() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  function close() {
    setOpen(false);
    setName("");
    setCode("");
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Folder-ийн нэрээ оруулна уу");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, visibility: "SHARED" }),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: { id: string }; message?: string }
        | null;
      if (!res.ok || !data?.project) {
        throw new Error(data?.message ?? "Үүсгэхэд алдаа гарлаа.");
      }
      toast.success("Shared folder үүсгэлээ");
      close();
      router.push(`/dashboard/project?projectId=${data.project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  async function join() {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Кодоо оруулна уу");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: { id: string }; message?: string }
        | null;
      if (!res.ok || !data?.project) {
        throw new Error(data?.message ?? "Нэгдэхэд алдаа гарлаа.");
      }
      toast.success("Folder-т нэгдлээ");
      close();
      router.push(`/dashboard/project?projectId=${data.project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button className="bg-primary text-primary-foreground" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New / Join
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">
              Shared folder
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "create" | "join")}>
            <TabsList className="w-full">
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="join">Join</TabsTrigger>
            </TabsList>

            {/* Create */}
            <TabsContent value="create" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Шинэ Shared folder үүсгэнэ. Урих код автоматаар үүсэх бөгөөд
                дотор нь <b>Invite</b> товчоор харж болно.
              </p>
              <div>
                <Label htmlFor="sharedname">Folder-ийн нэр</Label>
                <Input
                  id="sharedname"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void create();
                  }}
                  placeholder="Жишээ: Багийн төсөл"
                  className="mt-1.5"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  disabled={loading}
                  onClick={create}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create & open
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Join */}
            <TabsContent value="join" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Танд өгсөн кодыг оруулж Shared folder-т нэгдэнэ.
              </p>
              <div>
                <Label htmlFor="joincode">Урих код</Label>
                <Input
                  id="joincode"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void join();
                  }}
                  placeholder="Жишээ: AB7K2QMN"
                  className="mt-1.5 font-mono tracking-widest"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  disabled={loading}
                  onClick={join}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  Join
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
