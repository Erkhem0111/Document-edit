"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/hooks/use-project-folders";
import type { ApiProjectFile } from "@/types/domain";
import {
  Download,
  Eye,
  History,
  Lock,
  LockOpen,
  Trash2,
  Upload,
} from "lucide-react";

// FileActivity.action → монгол хаяг + icon
const ACTIVITY_LABELS = {
  VIEW: { label: "Үзсэн", icon: Eye },
  DOWNLOAD: { label: "Татсан", icon: Download },
  UPLOAD: { label: "Оруулсан", icon: Upload },
  LOCK: { label: "Түгжсэн", icon: Lock },
  UNLOCK: { label: "Түгжээ тайлсан", icon: LockOpen },
  DELETE_VERSION: { label: "Хувилбар устгасан", icon: Trash2 },
} as const;

// Файлын дэлгэрэнгүй: хувилбарын түүх + сүүлийн үйл ажиллагаа.
// Өгөгдөл нь GET /api/files/[fileId]-ээс аль хэдийн ирдэг тул шинэ хүсэлт хэрэггүй.
export function FileInfoDialog({
  file,
  open,
  onOpenChange,
}: {
  file: ApiProjectFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = file.versions ?? [];
  const activities = file.activities ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            <History className="mr-2 inline size-5" />
            Файлын түүх
          </DialogTitle>
        </DialogHeader>

        {/* Хувилбарууд */}
        <div>
          <Label>Хувилбарууд</Label>
          {versions.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Upload хийгдсэн хувилбар алга — энэ баримт editor дотор л амьдардаг.
            </p>
          ) : (
            <div className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                >
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold">
                    v{version.versionNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground">
                      {version.uploadedBy?.nickname ||
                        version.uploadedBy?.email ||
                        "?"}
                      {version.commitMsg ? ` — ${version.commitMsg}` : ""}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(version.createdAt), "MMM d, yyyy HH:mm")} ·{" "}
                      {formatBytes(version.fileSize)}
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Энэ хувилбарыг татах"
                  >
                    <a
                      href={`/api/files/${file.id}/download?version=${version.versionNumber}`}
                    >
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Үйл ажиллагаа */}
        <div className="border-t border-border pt-4">
          <Label>Сүүлийн үйл ажиллагаа</Label>
          {activities.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Бүртгэгдсэн үйлдэл алга.
            </p>
          ) : (
            <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
              {activities.map((activity) => {
                const meta = ACTIVITY_LABELS[activity.action] ?? {
                  label: activity.action,
                  icon: History,
                };
                const Icon = meta.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex min-w-0 items-center gap-2 px-1 py-1 text-xs"
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">
                      {activity.user?.nickname || activity.user?.email || "?"}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {meta.label}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {format(new Date(activity.createdAt), "MMM d, HH:mm")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
