"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, HardDrive } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileTypeIcon } from "@/components/file/file-type-icon";
import { formatBytes, useStorage } from "@/hooks/use-project-folders";
import { FOLDERS } from "@/lib/folders";

// ─── Хадгалах сан ─────────────────────────────────────────────────────────────
// Sidebar-ын доод хэсэгт өнгөт мөр — аль folder хэр их зай эзэлж байгааг
// нэг харцаар. Дарвал Windows-ын диск шиг дэлгэрэнгүй задаргаа нээгдэнэ.
// Өнгө нь sidebar дахь folder-ын өнгөтэй ижил тул тайлбаргүйгээр уншигдана.

export function StorageWidget() {
  const storage = useStorage();
  const [open, setOpen] = useState(false);

  const used = Number(storage?.usedBytes ?? 0);
  const quota = Number(storage?.quotaBytes ?? 0);
  const segments = FOLDERS.map((f) => ({
    ...f,
    bytes: Number(storage?.byCategory?.[f.key] ?? 0),
  })).filter((s) => s.bytes > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60"
      >
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/80">
          <HardDrive className="h-3.5 w-3.5" />
          Хадгалах сан
          <ChevronRight className="ml-auto h-3 w-3 text-sidebar-foreground/40" />
        </div>
        <UsageBar segments={segments} quota={quota} className="mt-2 h-1.5 bg-sidebar-accent" />
        <div className="mt-1.5 text-[10px] text-sidebar-foreground/50">
          {storage ? `${formatBytes(String(used))} / ${formatBytes(String(quota))} ашигласан` : "…"}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-teal" /> Хадгалах сан
            </DialogTitle>
          </DialogHeader>

          <div>
            <UsageBar segments={segments} quota={quota} className="h-3 bg-muted" />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatBytes(String(quota))}-аас {formatBytes(String(used))} ашигласан ·{" "}
              {formatBytes(String(Math.max(quota - used, 0)))} сул
            </p>
          </div>

          <div className="divide-y divide-border">
            {FOLDERS.map((f) => {
              const bytes = Number(storage?.byCategory?.[f.key] ?? 0);
              const pct = used > 0 ? (bytes / used) * 100 : 0;
              const Icon = f.icon;
              return (
                <div key={f.key} className="flex items-center gap-3 py-2.5 text-sm">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                  <span className="w-28 shrink-0">{f.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: f.color }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {bytes > 0 ? formatBytes(String(bytes)) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {(storage?.topFiles?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Хамгийн их зай эзэлж буй файлууд
              </p>
              <div className="divide-y divide-border">
                {storage!.topFiles!.map((file) => (
                  <Link
                    key={file.id}
                    href={`/dashboard/file?folderId=${file.projectId}&fileId=${file.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 py-2 text-sm hover:text-teal"
                  >
                    <FileTypeIcon name={file.name} mimeType={file.mimeType} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="max-w-32 shrink-0 truncate text-xs text-muted-foreground">
                      {file.projectName}
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {Number(storage?.byCategory?.TRASH ?? 0) > 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Хогийн сав {formatBytes(storage!.byCategory!.TRASH)} эзэлж байна — бүр
              мөсөн устгавал зай чөлөөлөгдөнө.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function UsageBar({
  segments,
  quota,
  className,
}: {
  segments: Array<{ key: string; color: string; bytes: number; label: string }>;
  quota: number;
  className?: string;
}) {
  return (
    <div className={`flex overflow-hidden rounded-full ${className ?? ""}`}>
      {segments.map((s) => (
        <div
          key={s.key}
          title={`${s.label}: ${formatBytes(String(s.bytes))}`}
          className="h-full"
          style={{
            // Маш жижиг ч гэсэн харагдахуйц (≥1.5%)
            width: `${quota > 0 ? Math.max((s.bytes / quota) * 100, 1.5) : 0}%`,
            backgroundColor: s.color,
          }}
        />
      ))}
    </div>
  );
}
