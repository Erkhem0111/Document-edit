"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ApiFolder } from "@/types/domain";

// Folder мөрийн жижиг цэс — нэр солих / устгах.
export function FolderActions({
  folder,
  onChanged,
  disabled = false,
}: {
  folder: ApiFolder;
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rename() {
    setOpen(false);
    const name = window.prompt("Folder-ийн шинэ нэр:", folder.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Нэр солиход алдаа гарлаа.");
      }
      toast.success("Нэр солигдлоо");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setOpen(false);
    if (
      !window.confirm(
        `"${folder.name}" folder-ийг устгах уу? Доторх дэд folder-ууд устаж, файлууд эх folder руу шилжинэ.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Устгахад алдаа гарлаа.");
      }
      toast.success("Folder устгагдлаа");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        disabled={busy || disabled}
        title={disabled ? "Reference folder read-only" : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 group-hover:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-popover p-1 text-sm shadow-card">
            <button
              onClick={rename}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-foreground transition hover:bg-accent"
            >
              <Pencil className="size-4" /> Rename
            </button>
            <button
              onClick={remove}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-destructive transition hover:bg-accent"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
