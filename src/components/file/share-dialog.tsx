"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { Copy, Link as LinkIcon, Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import type { ApiProject, ProjectRole } from "@/types/domain";

// ─── Файл хуваалцах dialog ────────────────────────────────────────────────────
// • Линк хуулах — хандах эрхтэй хүнд шууд нээгдэнэ
// • Owner: имэйлээр гишүүн нэмэх (Viewer/Editor)
// • Owner + Shared folder: урих код харах/сэргээх
export function ShareDialog({
  project,
  fileId,
  isOwner,
  open,
  onOpenChange,
  onChanged,
}: {
  project: ApiProject;
  // Өгөөгүй бол төслийг бүхэлд нь хуваалцана (холбоос нь төсөл рүү заана)
  fileId?: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("EDITOR");
  const [adding, setAdding] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  const isPrivate = project.visibility === "PRIVATE";
  const isShared = project.visibility === "SHARED";
  const members = project.members ?? [];
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : fileId
        ? `${window.location.origin}/dashboard/file?folderId=${project.id}&fileId=${fileId}`
        : `${window.location.origin}/dashboard/project?projectId=${project.id}`;

  // Shared folder-ийн урих кодыг owner нээмэгц ачаална
  useEffect(() => {
    if (!open || !isOwner || !isShared || inviteCode) return;
    void loadCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isOwner, isShared]);

  async function loadCode(rotate: boolean) {
    setCodeLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const data = (await res.json().catch(() => null)) as
        | { inviteCode?: string; message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Код авахад алдаа гарлаа.");
      setInviteCode(data?.inviteCode ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setCodeLoading(false);
    }
  }

  async function copyLink() {
    if (await copyText(shareUrl)) toast.success("Линк хууллаа");
    else toast.error("Хуулж чадсангүй — линкийг гараар хуулна уу.");
  }

  async function copyCode() {
    if (!inviteCode) return;
    if (await copyText(inviteCode)) toast.success("Код хууллаа");
    else toast.error("Хуулж чадсангүй — кодыг гараар хуулна уу.");
  }

  // Owner: гишүүний эрх өөрчлөх / хасах
  async function updateMember(memberId: string, nextRole: ProjectRole | null) {
    setMemberBusy(memberId);
    try {
      const res = await fetch(`/api/projects/${project.id}/members/${memberId}`, {
        method: nextRole ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: nextRole ? JSON.stringify({ role: nextRole }) : undefined,
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Өөрчилж чадсангүй.");
      toast.success(nextRole ? "Эрх өөрчлөгдлөө" : "Гишүүн хасагдлаа");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setMemberBusy(null);
    }
  }

  async function addMember() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Имэйл оруулна уу");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Гишүүн нэмж чадсангүй.");
      toast.success(`${trimmed} нэмэгдлээ`);
      setEmail("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            {fileId ? "Хуваалцах" : `“${project.name}”-ийг хуваалцах`}
          </DialogTitle>
        </DialogHeader>

        {/* Линк хуулах */}
        <div className="flex min-w-0 items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground outline-none"
          />
          <Button variant="outline" size="sm" className="shrink-0" onClick={copyLink}>
            <LinkIcon className="mr-1.5 size-3.5" /> Холбоос хуулах
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isPrivate
            ? "Private folder — зөвхөн та өөрөө нээж чадна. Хуваалцахын тулд файлаа Shared/Public folder руу зөөнө үү."
            : "Линкийг хандах эрхтэй хүн л нээж чадна."}
        </p>

        {/* Owner: имэйлээр гишүүн нэмэх (Private-д хориотой) */}
        {isOwner && !isPrivate && (
          <div className="border-t border-border pt-4">
            <Label htmlFor="share-email">Имэйлээр нэмэх</Label>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <Input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addMember();
                }}
                placeholder="you@firm.co"
                className="min-w-0 flex-1"
              />
              <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Харах</SelectItem>
                  <SelectItem value="EDITOR">Засах</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                className="shrink-0 bg-primary text-primary-foreground"
                disabled={adding}
                onClick={addMember}
                title="Нэмэх"
              >
                {adding ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Owner + Shared: урих код */}
        {isOwner && isShared && (
          <div className="border-t border-border pt-4">
            <Label>Урих код</Label>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-center font-mono text-lg tracking-[0.25em]">
                {codeLoading ? (
                  <Loader2 className="mx-auto size-4 animate-spin" />
                ) : (
                  (inviteCode ?? "—")
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Хуулах"
                onClick={copyCode}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Шинэ код үүсгэх"
                disabled={codeLoading}
                onClick={() => loadCode(true)}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Гишүүдийн жагсаалт */}
        {members.length > 0 && (
          <div className="border-t border-border pt-4">
            <Label>Хандах эрхтэй хүмүүс</Label>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
              {members.map((member, index) => (
                <div
                  key={member.user?.id ?? index}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-accent-foreground">
                    {(member.user?.nickname || member.user?.email || "?")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {member.user?.nickname || member.user?.email}
                  </span>
                  {isOwner && member.id && member.role !== "OWNER" ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <Select
                        value={member.role}
                        disabled={memberBusy === member.id}
                        onValueChange={(v) => void updateMember(member.id!, v as ProjectRole)}
                      >
                        <SelectTrigger className="h-7 w-20 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">Харах</SelectItem>
                          <SelectItem value="EDITOR">Засах</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Хасах"
                        disabled={memberBusy === member.id}
                        onClick={() => {
                          if (window.confirm(`${member.user?.nickname || member.user?.email}-г хасах уу?`)) {
                            void updateMember(member.id!, null);
                          }
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </span>
                  ) : (
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {member.role === "OWNER"
                        ? "Эзэмшигч"
                        : member.role === "EDITOR"
                          ? "Засах"
                          : "Харах"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
