"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyProjectsChanged } from "@/hooks/use-project-folders";

// Нэг товчоор шинэ баримт: нэр асуухгүй шууд үүсгээд editor-ийг нээнэ
// (Google Docs шиг — нэрийг editor-ийн гарчгаас солино).
// projectId өгөөгүй бол сервер "Миний баримтууд"-д үүсгэнэ.
export function useCreateDocument() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const createDocument = useCallback(
    async (options: { projectId?: string; folderId?: string | null } = {}) => {
      if (creating) return;
      setCreating(true);
      try {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });
        const data = (await res.json().catch(() => null)) as
          | { file?: { id: string; projectId: string }; message?: string }
          | null;
        if (!res.ok || !data?.file) {
          throw new Error(data?.message ?? "Баримт үүсгэж чадсангүй.");
        }
        notifyProjectsChanged();
        router.push(
          `/dashboard/file?folderId=${data.file.projectId}&fileId=${data.file.id}`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Баримт үүсгэж чадсангүй.");
      } finally {
        setCreating(false);
      }
    },
    [creating, router],
  );

  return { createDocument, creating };
}
