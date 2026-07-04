"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiProject, ApiProjectFile, ProjectRole } from "@/types/domain";

const PROJECT_COLORS = ["#0f766e", "#b45309", "#4f46e5", "#be123c", "#0369a1"];
export type FileIconType = "doc" | "map" | "report" | "survey" | "image" | "file";

type AsyncState = {
  loading: boolean;
  error: string | null;
};

type UseProjectFoldersResult = AsyncState & {
  projects: ApiProject[];
  refresh: () => Promise<void>;
};

type UseProjectFolderResult = AsyncState & {
  project: ApiProject | null;
  refresh: () => Promise<void>;
};

type UseProjectFileResult = AsyncState & {
  file: ApiProjectFile | null;
};

// ─── Helper functions ─────────────────────────────────────────────────────────

export function formatBytes(value?: string) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

// Өмнө: file/page.tsx болон folder/page.tsx хоёуланд адилхан функц давхардаж байсан
// Одоо: нэг газарт төвлөрүүлж export хийв
export function getFilePermission(
  file: ApiProjectFile,
  userId: string,
  projectRole?: ProjectRole,
): string {
  if (projectRole === "OWNER") return "Owner";
  if (projectRole === "EDITOR") return "Editor";
  if (file.uploaderId === userId) return "Owner";
  if (file.editorIds.includes(userId)) return "Editor";
  if (file.viewerIds.includes(userId) || projectRole === "VIEWER") return "Viewer";
  return "Viewer";
}

// Өмнө: file/page.tsx дотор inline бичигдсэн байсан
// Одоо: export хийв — folder/page.tsx ч ашиглаж болно
export function getFileSize(file: ApiProjectFile): string {
  return file.versions?.[0]?.fileSize
    ? formatBytes(file.versions[0].fileSize)
    : "-";
}

export function getPermission(role?: ProjectRole) {
  if (role === "OWNER") return "Owner";
  if (role === "EDITOR") return "Editor";
  return "Viewer";
}

export function getFileType(file: ApiProjectFile): FileIconType {
  const name = file.name.toLowerCase();
  if (file.mimeType.startsWith("image/")) return "image";
  if (/\.(dwg|dxf|ifc|rvt)$/.test(name)) return "map";
  if (/\.(pdf|txt|docx?)$/.test(name)) return "doc";
  if (/\.(xlsx?|csv)$/.test(name)) return "report";
  return "file";
}

export function getProjectColor(index = 0) {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

export function getOwnerName(file: ApiProjectFile) {
  return file.uploader?.nickname ?? file.uploader?.email ?? "Unknown";
}

export function getProjectRole(project: ApiProject) {
  return project.members?.[0]?.role;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(body?.message ?? "Failed to load workspace data.");
  }
  return response.json() as Promise<T>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

// setState-уудыг зөвхөн await-ийн дараа (async callback дотор) дуудна.
// → effect синхрон setState дуудахгүй (react-hooks/set-state-in-effect).
// refresh нь event handler-аас дуудагддаг тул loading-ийг шууд тавьж болно.

// Файл/project үүсгэх, устгах зэрэг үйлдлийн дараа дуудна —
// бүх useProjectFolders instance (зүүн sidebar гэх мэт) жагсаалтаа дахин ачаална.
// Ингэснээр sidebar хуучирсан (устгагдсан) файл харуулахгүй.
const PROJECTS_CHANGED_EVENT = "tls:projects-changed";

export function notifyProjectsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
  }
}

export function useProjectFolders(): UseProjectFoldersResult {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await readJson<{ projects: ApiProject[] }>("/api/projects");
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  useEffect(() => {
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа болдог тул хэвийн
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
  }, [load]);

  return { projects, loading, error, refresh };
}

export function useProjectFolder(projectId: string): UseProjectFolderResult {
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await readJson<{ project: ApiProject }>(
        `/api/projects/${projectId}`,
      );
      setProject(data.project);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  useEffect(() => {
    if (!projectId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [projectId, load]);

  return { project, loading, error, refresh };
}

export type StorageInfo = { usedBytes: string; quotaBytes: string };

export function useStorage(): StorageInfo | null {
  const [data, setData] = useState<StorageInfo | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await readJson<StorageInfo>("/api/storage"));
    } catch {
      // storage мэдээлэл заавал биш — алдааг чимээгүй өнгөрөөнө
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return data;
}

export function useProjectFile(fileId: string): UseProjectFileResult {
  const [file, setFile] = useState<ApiProjectFile | null>(null);
  const [loading, setLoading] = useState(Boolean(fileId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await readJson<{ file: ApiProjectFile }>(
        `/api/files/${fileId}`,
      );
      setFile(data.file);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file.");
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (!fileId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [fileId, load]);

  return { file, loading, error };
}
