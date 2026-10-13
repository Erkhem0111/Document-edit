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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  notifyProjectsChanged,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import {
  DIRECT_WORKSPACE_KEYS,
  VISIBILITY_FOLDERS,
  getProjectFolderKey,
} from "@/lib/folders";
import type { ApiFolder } from "@/types/domain";
import { FolderInput, Loader2 } from "lucide-react";

// Дэд folder-уудыг мод хэлбэрээр ("Зураг / 2026") эрэмбэлнэ
function folderOptions(folders: ApiFolder[]) {
  const children = new Map<string | null, ApiFolder[]>();
  for (const f of folders) {
    const list = children.get(f.parentId) ?? [];
    list.push(f);
    children.set(f.parentId, list);
  }
  const out: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, prefix: string) => {
    for (const f of children.get(parentId) ?? []) {
      const label = prefix ? `${prefix} / ${f.name}` : f.name;
      out.push({ id: f.id, label });
      walk(f.id, label);
    }
  };
  walk(null, "");
  return out;
}

// Ганц файлыг өөр project (folder) эсвэл дэд folder руу зөөнө.
export function MoveFileDialog({
  file,
  currentProjectId,
  open,
  onOpenChange,
  onMoved,
}: {
  file: { id: string; name: string };
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
    const key = getProjectFolderKey(p);
    if (key === "TRASH") return false;
    const myRole = p.members?.[0]?.role;
    if (user?.role === "ADMIN") return true;
    if (key === "REFERENCE") return myRole === "OWNER";
    return myRole === "OWNER" || myRole === "EDITOR";
  });

  // Миний файлууд / Төслүүд / Компанийн сан гэж бүлэглэнэ. Бүлэгт ганц
  // ажлын орчин байвал (sidebar-тай адил) төслийн нэрийн оронд бүлгийн нэрийг харуулна.
  const groups = VISIBILITY_FOLDERS.map((folder) => {
    const items = destinations.filter((p) => getProjectFolderKey(p) === folder.key);
    const single = DIRECT_WORKSPACE_KEYS.includes(folder.key) && items.length === 1;
    return {
      folder,
      items: items.map((p) => ({
        project: p,
        label: single ? folder.label : p.name,
      })),
    };
  }).filter((g) => g.items.length > 0);

  const targetProject = destinations.find((p) => p.id === targetProjectId);
  const targetFolders = folderOptions(targetProject?.folders ?? []);

  async function move() {
    setBusy(true);
    try {
      const res = await fetch(`/api/files/${file.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: targetProjectId,
          folderId: folderId === "root" ? null : folderId,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Зөөж чадсангүй.");
      toast.success(`"${file.name}" зөөгдлөө`);
      notifyProjectsChanged();
      await onMoved();
      onOpenChange(false);
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
            Файл зөөх
          </DialogTitle>
        </DialogHeader>

        <p className="truncate text-sm text-muted-foreground">{file.name}</p>

        <div>
          <Label>Хаашаа</Label>
          <Select
            value={targetProjectId}
            onValueChange={(v) => {
              setTargetProjectId(v);
              setFolderId("root");
            }}
          >
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map(({ folder, items }) => {
                const Icon = folder.icon;
                return (
                  <SelectGroup key={folder.key}>
                    <SelectLabel className="flex items-center gap-1.5">
                      <Icon className="size-3.5" style={{ color: folder.color }} />
                      {folder.label}
                    </SelectLabel>
                    {items.map(({ project, label }) => (
                      <SelectItem key={project.id} value={project.id} className="pl-7">
                        {label}
                        {project.id === currentProjectId && (
                          <span className="ml-1.5 text-xs text-muted-foreground">· одоогийнх</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
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
