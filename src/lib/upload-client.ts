"use client";

import { DIRECT_UPLOAD_THRESHOLD, MAX_UPLOAD_BYTES } from "@/lib/upload";

// ─── Файлыг төсөлд оруулах (browser тал) ─────────────────────────────────────
// Жижиг файл (≤4MB) — урьдын адил server-ээр.
// Том файл — Vercel-ийн 4.5MB хязгаарыг тойрч browser шууд R2 руу илгээнэ,
// дараа нь server бүртгэнэ. Амжилтгүй бол ойлгомжтой мессежтэй Error шиднэ.

async function readMessage(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export async function uploadProjectFile(
  projectId: string,
  file: File,
  folderId?: string | null,
): Promise<{ id: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Файл хэтэрхий том байна (дээд тал нь 50MB).");
  }

  if (file.size <= DIRECT_UPLOAD_THRESHOLD) {
    const form = new FormData();
    form.append("file", file);
    if (folderId) form.append("folderId", folderId);
    const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: form });
    if (res.status === 413) throw new Error("Файл хэтэрхий том байна.");
    if (!res.ok) throw new Error(await readMessage(res, "Оруулж чадсангүй."));
    const data = (await res.json()) as { file: { id: string } };
    return data.file;
  }

  const endpoint = `/api/projects/${projectId}/files/direct`;
  const type = file.type || "application/octet-stream";
  const start = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", name: file.name, size: file.size, type }),
  });
  if (!start.ok) throw new Error(await readMessage(start, "Оруулж чадсангүй."));
  const { uploadUrl, key, token } = (await start.json()) as {
    uploadUrl: string;
    key: string;
    token: string;
  };

  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
  } catch {
    // Ихэвчлэн R2 bucket-ийн CORS тохиргоо хийгдээгүй үед
    throw new Error(
      "Том файлыг cloud storage руу илгээж чадсангүй. Интернэтээ шалгаад дахин оролдоно уу — " +
        "давтагдвал админ R2-ийн CORS тохиргоог шалгана.",
    );
  }
  if (!put.ok) throw new Error("Том файлыг cloud storage руу илгээж чадсангүй.");

  const done = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", key, token, name: file.name, type, folderId }),
  });
  if (!done.ok) throw new Error(await readMessage(done, "Оруулж чадсангүй."));
  return ((await done.json()) as { file: { id: string } }).file;
}
