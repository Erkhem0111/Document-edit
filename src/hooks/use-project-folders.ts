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
export function getFilePermission(file: ApiProjectFile, userId: string): string {
  if (file.uploaderId === userId) return "Owner";
  if (file.editorIds.includes(userId)) return "Editor";
  if (file.viewerIds.includes(userId)) return "Viewer";
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

export function useProjectFolders(): UseProjectFoldersResult {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readJson<{ projects: ApiProject[] }>("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}

export function useProjectFolder(projectId: string): UseProjectFolderResult {
  const [project, setProject] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    readJson<{ project: ApiProject }>(`/api/projects/${projectId}`)
      .then((data) => { if (active) setProject(data.project); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load project."); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [projectId]);

  return { project, loading, error };
}

export function useProjectFile(fileId: string): UseProjectFileResult {
  const [file, setFile] = useState<ApiProjectFile | null>(null);
  const [loading, setLoading] = useState(Boolean(fileId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setFile(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    readJson<{ file: ApiProjectFile }>(`/api/files/${fileId}`)
      .then((data) => { if (active) setFile(data.file); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load file."); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [fileId]);

  return { file, loading, error };
}