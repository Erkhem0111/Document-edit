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
import { getFolder, getProjectFolderKey } from "@/lib/folders";
import { FolderInput, Loader2 } from "lucide-react";

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
    if (key === "TRASH" || key === "ARCHIVE") return false;
    const myRole = p.members?.[0]?.role;
    if (user?.role === "ADMIN") return true;
    if (key === "REFERENCE") return myRole === "OWNER";
    return myRole === "OWNER" || myRole === "EDITOR";
  });

  const targetProject = destinations.find((p) => p.id === targetProjectId);
  const targetFolders = targetProject?.folders ?? [];

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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            <FolderInput className="mr-2 inline size-5" />
            Файл зөөх
          </DialogTitle>
        </DialogHeader>

        <p className="truncate text-sm text-muted-foreground">{file.name}</p>

        <div>
          <Label>Очих folder (project)</Label>
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
              {destinations.map((p) => {
                const folderDef = getFolder(getProjectFolderKey(p));
                return (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {folderDef ? ` (${folderDef.label})` : ""}
                    {p.id === currentProjectId ? " — одоогийнх" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Дэд folder</Label>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Үндсэн түвшин (root)</SelectItem>
              {targetFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
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
