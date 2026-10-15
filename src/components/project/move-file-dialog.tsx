"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/hooks/use-auth";
import {
  notifyProjectsChanged,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import { getProjectFolderKey } from "@/lib/folders";
import { ProjectSelect } from "@/components/project/project-select";
import type { ApiFolder } from "@/types/domain";
import { FolderInput, Loader2 } from "lucide-react";

// Дэд folder-уудыг мод хэлбэрээр ("Зураг / 2026") эрэмбэлнэ.
// skip — зөөгдөж буй хавтсууд: тэдгээр болон доторх хавтсууд руу зөөж болохгүй
function folderOptions(folders: ApiFolder[], skip: Set<string> = new Set()) {
  const children = new Map<string | null, ApiFolder[]>();
  for (const f of folders) {
    const list = children.get(f.parentId) ?? [];
    list.push(f);
    children.set(f.parentId, list);
  }
  const out: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, prefix: string) => {
    for (const f of children.get(parentId) ?? []) {
      if (skip.has(f.id)) continue;
      const label = prefix ? `${prefix} / ${f.name}` : f.name;
      out.push({ id: f.id, label });
      walk(f.id, label);
    }
  };
  walk(null, "");
  return out;
}

// Нэг эсвэл олон файл, хавтсыг зөөнө. Файл өөр төсөл рүү ч зөөгдөнө;
// хавтас сонгогдсон бол (доторх зүйлсийн хамт) зөвхөн энэ төслийн дотор зөөнө.
export function MoveFileDialog({
  files,
  folders = [],
  currentProjectId,
  open,
  onOpenChange,
  onMoved,
}: {
  files: { id: string; name: string }[];
  folders?: { id: string; name: string }[];
  currentProjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const { projects } = useProjectFolders();
  const [targetProjectId, setTargetProjectId] = useState(currentProjectId);
  const [folderId, setFolderId] = useState<string>("root");
  const [busy, setBusy] = useState(false);

  // Зөөж болох газрууд: Trash/Archive биш, файл нэмэх эрхтэй project-ууд
  // (Reference-д зөвхөн эзэн нь нэмнэ — сервер давхар шалгана)
  const destinations = projects.filter((p) => {
    if (folders.length > 0 && p.id !== currentProjectId) return false;
    const key = getProjectFolderKey(p);
    if (key === "TRASH") return false;
    const myRole = p.members?.[0]?.role;
    if (user?.role === "ADMIN") return true;
    if (key === "REFERENCE") return myRole === "OWNER";
    return myRole === "OWNER" || myRole === "EDITOR";
  });

  const targetProject = destinations.find((p) => p.id === targetProjectId);
  const targetFolders = folderOptions(
    targetProject?.folders ?? [],
    new Set(folders.map((f) => f.id)),
  );
  const total = files.length + folders.length;
  const what =
    folders.length && files.length
      ? `${total} зүйл`
      : folders.length
        ? `${folders.length} хавтас`
        : `${files.length} файл`;

  async function move() {
    setBusy(true);
    let moved = 0;
    const parentId = folderId === "root" ? null : folderId;
    try {
      for (const folder of folders) {
        const res = await fetch(`/api/folders/${folder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId }),
        });
        if (res.ok) {
          moved += 1;
          continue;
        }
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(`"${folder.name}": ${data?.message ?? "зөөж чадсангүй"}`);
      }
      for (const file of files) {
        const res = await fetch(`/api/files/${file.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: targetProjectId,
            folderId: parentId,
          }),
        });
        if (res.ok) {
          moved += 1;
          continue;
        }
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(`"${file.name}": ${data?.message ?? "зөөж чадсангүй"}`);
      }
      if (moved > 0) {
        toast.success(
          total === 1 ? `"${(folders[0] ?? files[0]).name}" зөөгдлөө` : `${moved} зүйл зөөгдлөө`,
        );
        notifyProjectsChanged();
        await onMoved();
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            <FolderInput className="mr-2 inline size-5" />
            {total > 1 ? `${what} зөөх` : folders.length ? "Хавтас зөөх" : "Файл зөөх"}
          </DialogTitle>
        </DialogHeader>

        <p className="truncate text-sm text-muted-foreground">
          {total === 1 ? (folders[0] ?? files[0]).name : what}
          {folders.length > 0 && " · хавтсыг энэ төслийн дотор зөөнө"}
        </p>

        <div>
          <Label>Хаашаа</Label>
          <ProjectSelect
            projects={destinations}
            value={targetProjectId}
            currentProjectId={currentProjectId}
            onChange={(v) => {
              setTargetProjectId(v);
              setFolderId("root");
            }}
          />
        </div>

        <div>
          <Label>Хавтас</Label>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Үндсэн хэсэг</SelectItem>
              {targetFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy}
            onClick={move}
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FolderInput className="mr-2 size-4" />
            )}
            Зөөх
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
