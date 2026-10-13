"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Link as LinkIcon, Loader2, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeoplePicker, PersonAvatar, type DirectoryUser } from "@/components/people/people-picker";
import { copyText } from "@/lib/clipboard";
import { notifyProjectsChanged } from "@/hooks/use-project-folders";
import type { ApiProject, ProjectRole } from "@/types/domain";

// ─── Хуваалцах (Google Docs маягийн) ─────────────────────────────────────────
// 1) Хүн нэмэх — компанийн жагсаалтаас нэрээр сонгоно, нэмэгдсэн хүнд имэйл очно
// 2) Хандах эрхтэй хүмүүс — эрх солих / хасах нэг цэсэнд
// 3) Ерөнхий хандалт — зөвхөн нэмсэн хүмүүс эсвэл компанийн бүх хүн
// Урих код байхгүй. Эрх бүрийг сервер дахин шалгана.

const ROLE_LABEL: Record<ProjectRole, string> = { OWNER: "Эзэмшигч", EDITOR: "Засах", VIEWER: "Харах" };

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
  const [picked, setPicked] = useState<DirectoryUser[]>([]);
  const [role, setRole] = useState<ProjectRole>("EDITOR");
  const [adding, setAdding] = useState(false);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);

  const isPrivate = project.visibility === "PRIVATE";
  const isReference = project.visibility === "REFERENCE";
  const canInvite = isOwner && !isPrivate;
  // Эзэмшигч эхэнд
  const members = [...(project.members ?? [])].sort(
    (a, b) => Number(b.role === "OWNER") - Number(a.role === "OWNER"),
  );
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : fileId
        ? `${window.location.origin}/dashboard/file?folderId=${project.id}&fileId=${fileId}`
        : `${window.location.origin}/dashboard/project?projectId=${project.id}`;

  async function addPeople() {
    if (picked.length === 0) return;
    setAdding(true);
    const failed: string[] = [];
    for (const person of picked) {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: person.email, role }),
      }).catch(() => null);
      if (!res?.ok) failed.push(person.nickname || person.email);
    }
    setAdding(false);
    if (failed.length > 0) toast.error(`Нэмж чадсангүй: ${failed.join(", ")}`);
    const added = picked.length - failed.length;
    if (added > 0) toast.success(`${added} хүн нэмэгдлээ — имэйлээр мэдэгдэнэ`);
    setPicked([]);
    notifyProjectsChanged();
    await onChanged();
  }

  // Эрх солих (VIEWER/EDITOR) эсвэл хасах ("REMOVE")
  async function updateMember(memberId: string, next: ProjectRole | "REMOVE", name: string) {
    if (next === "REMOVE" && !window.confirm(`${name}-г хасах уу?`)) return;
    setMemberBusy(memberId);
    try {
      const res = await fetch(`/api/projects/${project.id}/members/${memberId}`, {
        method: next === "REMOVE" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: next === "REMOVE" ? undefined : JSON.stringify({ role: next }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(data?.message ?? "Өөрчилж чадсангүй.");
      toast.success(next === "REMOVE" ? "Хасагдлаа" : "Эрх өөрчлөгдлөө");
      notifyProjectsChanged();
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setMemberBusy(null);
    }
  }

  async function setAccess(visibility: "SHARED" | "PUBLIC") {
    if (visibility === project.visibility) return;
    if (
      visibility === "PUBLIC" &&
      !window.confirm("Компанийн БҮХ хэрэглэгч энэ төслийн файлуудыг харах боломжтой болно. Үргэлжлүүлэх үү?")
    ) {
      return;
    }
    setAccessBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Өөрчилж чадсангүй.");
      }
      toast.success(visibility === "PUBLIC" ? "Компанийн бүх хүнд нээгдлээ" : "Зөвхөн нэмсэн хүмүүст");
      notifyProjectsChanged();
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Өөрчилж чадсангүй.");
    } finally {
      setAccessBusy(false);
    }
  }

  async function copyLink() {
    if (await copyText(shareUrl)) toast.success("Холбоос хуулагдлаа");
    else toast.error("Хуулж чадсангүй — холбоосыг гараар хуулна уу.");
  }

  const access = isPrivate
    ? { icon: Lock, title: "Зөвхөн та", hint: "“Миний файлууд” — өөр хэн ч нээхгүй. Хуваалцах бол төсөл рүү зөөнө үү." }
    : isReference
      ? { icon: Building2, title: "Компанийн сан", hint: "Компанийн бүх хүн харна, эзэмшигч/админ засна." }
      : project.visibility === "PUBLIC"
        ? { icon: Building2, title: "Компанийн бүх хүн", hint: "Бүгд харна, нэмсэн хүмүүс эрхээрээ засна." }
        : { icon: Users, title: "Зөвхөн нэмсэн хүмүүс", hint: "Доорх жагсаалтын хүмүүс л нээнэ." };
  const AccessIcon = access.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicked([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 sm:max-w-lg">
        <DialogHeader className="pb-4">
          <DialogTitle className="truncate pr-6 font-sans text-lg">“{project.name}”-ийг хуваалцах</DialogTitle>
        </DialogHeader>

        {/* 1. Хүн нэмэх */}
        {canInvite && (
          <div className="space-y-2">
            <PeoplePicker
              value={picked}
              onChange={setPicked}
              excludeIds={members.map((m) => m.user?.id).filter(Boolean) as string[]}
              placeholder="Хүн нэмэх — нэр эсвэл имэйл"
            />
            {picked.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                  <SelectTrigger className="h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EDITOR">Засах</SelectItem>
                    <SelectItem value="VIEWER">Харах</SelectItem>
                  </SelectContent>
                </Select>
                <span className="flex-1 text-xs text-muted-foreground">Нэмэгдсэн хүнд имэйлээр мэдэгдэнэ.</span>
                <Button className="bg-primary text-primary-foreground" disabled={adding} onClick={() => void addPeople()}>
                  {adding && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Нэмэх
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 2. Хандах эрхтэй хүмүүс */}
        {!isPrivate && members.length > 0 && (
          <div className={canInvite ? "mt-5" : ""}>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Хандах эрхтэй хүмүүс</div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {members.map((member, index) => {
                const name = member.user?.nickname || member.user?.email || "?";
                const editable = isOwner && member.id && member.role !== "OWNER";
                return (
                  <div key={member.user?.id ?? index} className="flex min-w-0 items-center gap-2.5 rounded-md py-1.5">
                    <PersonAvatar user={member.user ?? {}} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{name}</div>
                      {member.user?.nickname && (
                        <div className="truncate text-xs text-muted-foreground">{member.user.email}</div>
                      )}
                    </div>
                    {editable ? (
                      <Select
                        value={member.role}
                        disabled={memberBusy === member.id}
                        onValueChange={(v) => void updateMember(member.id!, v as ProjectRole | "REMOVE", name)}
                      >
                        <SelectTrigger className="h-8 w-28 shrink-0 border-transparent text-xs hover:border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Засах</SelectItem>
                          <SelectItem value="VIEWER">Харах</SelectItem>
                          <SelectSeparator />
                          <SelectItem value="REMOVE" className="text-destructive">
                            Хасах
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="shrink-0 px-3 text-xs text-muted-foreground">{ROLE_LABEL[member.role]}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Ерөнхий хандалт */}
        <div className="mt-5">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Ерөнхий хандалт</div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
              <AccessIcon className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              {isOwner && !isPrivate && !isReference ? (
                <Select
                  value={project.visibility}
                  disabled={accessBusy}
                  onValueChange={(v) => void setAccess(v as "SHARED" | "PUBLIC")}
                >
                  <SelectTrigger className="-ml-2 h-7 w-fit border-transparent px-2 text-sm font-medium hover:border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHARED">Зөвхөн нэмсэн хүмүүс</SelectItem>
                    <SelectItem value="PUBLIC">Компанийн бүх хүн</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm font-medium">{access.title}</div>
              )}
              <div className="text-xs text-muted-foreground">{access.hint}</div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="outline" className="rounded-full" onClick={() => void copyLink()}>
            <LinkIcon className="mr-1.5 h-4 w-4" /> Холбоос хуулах
          </Button>
          <Button className="rounded-full bg-primary px-6 text-primary-foreground" onClick={() => onOpenChange(false)}>
            Болсон
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
