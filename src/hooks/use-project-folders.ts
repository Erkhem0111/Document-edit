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
  refresh: () => Promise<void>;
};

let projectListRequest: Promise<ApiProject[]> | null = null;
let projectListCache: ApiProject[] = [];
let projectListError: string | null = null;

const projectDetailRequests = new Map<string, Promise<ApiProject>>();
const fileDetailRequests = new Map<string, Promise<ApiProjectFile>>();
// Сүүлд ачаалсан өгөгдөл — хуудас руу буцаж ороход "Loading" харуулалгүй
// шууд үзүүлээд, ар талд нь шинэчилнэ (stale-while-revalidate).
const projectDetailCache = new Map<string, ApiProject>();
const fileDetailCache = new Map<string, ApiProjectFile>();
const httpCache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

function getCacheKey(url: string) {
  return url;
}

function setCachedResponse<T>(url: string, promise: Promise<T>, ttlMs: number) {
  httpCache.set(url, {
    promise: promise as Promise<unknown>,
    expiresAt: Date.now() + ttlMs,
  });
}

async function loadProjectList(force = false): Promise<ApiProject[]> {
  if (projectListRequest && !force) return projectListRequest;

  projectListRequest = readJson<{ projects: ApiProject[] }>("/api/projects", {
    force,
    ttlMs: 15000,
  })
    .then((data) => {
      projectListCache = data.projects;
      projectListError = null;
      return projectListCache;
    })
    .catch((error) => {
      projectListError =
        error instanceof Error ? error.message : "Failed to load projects.";
      throw error;
    })
    .finally(() => {
      projectListRequest = null;
    });

  return projectListRequest;
}

// refresh() + notifyProjectsChanged() дараалан дуудагдахад ижил төслийг
// хоёр удаа татахгүйн тулд саяхан (1с дотор) татсан бол түүнийг ашиглана.
const projectFetchedAt = new Map<string, number>();

async function loadProjectDetail(projectId: string, force = false): Promise<ApiProject> {
  const existing = projectDetailRequests.get(projectId);
  if (existing) return existing;
  const cached = projectDetailCache.get(projectId);
  if (force && cached && Date.now() - (projectFetchedAt.get(projectId) ?? 0) < 1000) {
    return cached;
  }

  const request = readJson<{ project: ApiProject }>(`/api/projects/${projectId}`, {
    force,
    ttlMs: 15000,
  })
    .then((data) => {
      projectDetailCache.set(projectId, data.project);
      projectFetchedAt.set(projectId, Date.now());
      return data.project;
    })
    .finally(() => {
      projectDetailRequests.delete(projectId);
    });

  projectDetailRequests.set(projectId, request);
  return request;
}

async function loadFileDetail(fileId: string, force = false): Promise<ApiProjectFile> {
  const existing = fileDetailRequests.get(fileId);
  if (existing && !force) return existing;

  const request = readJson<{ file: ApiProjectFile }>(`/api/files/${fileId}`, {
    force,
    ttlMs: 15000,
  })
    .then((data) => {
      fileDetailCache.set(fileId, data.file);
      return data.file;
    })
    .finally(() => {
      fileDetailRequests.delete(fileId);
    });

  fileDetailRequests.set(fileId, request);
  return request;
}

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

// Эрх зөвхөн project-ийн role-оос ирнэ — file-ийн legacy viewerIds/editorIds-ийг
// сервер тооцдоггүй тул badge ч мөн тооцохгүй (худал "Editor" харуулахгүй).
export function getFilePermission(
  projectRole?: ProjectRole,
  globalRole?: string,
): string {
  if (globalRole === "ADMIN" || projectRole === "OWNER") return "Owner";
  if (projectRole === "EDITOR") return "Editor";
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

async function readJson<T>(
  url: string,
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<T> {
  const { force = false, ttlMs = 0 } = options;
  const cacheKey = getCacheKey(url);
  const cached = httpCache.get(cacheKey);

  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.promise as Promise<T>;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Failed to load workspace data.");
      }

      return (await response.json()) as T;
    })
    .then((data) => {
      if (ttlMs > 0) {
        setCachedResponse(cacheKey, Promise.resolve(data), ttlMs);
      } else {
        httpCache.delete(cacheKey);
      }
      return data;
    })
    .catch((error) => {
      httpCache.delete(cacheKey);
      throw error;
    });

  if (ttlMs > 0) {
    setCachedResponse(cacheKey, request, ttlMs);
  }

  return request;
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
  const [projects, setProjects] = useState<ApiProject[]>(projectListCache);
  const [loading, setLoading] = useState(
    projectListRequest !== null || (projectListCache.length === 0 && projectListError === null),
  );
  const [error, setError] = useState<string | null>(projectListError);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadProjectList();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadProjectList(true);
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа болдог тул хэвийн
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => void refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
  }, [refresh]);

  return { projects, loading, error, refresh };
}

// id-тай холбосон state — өөр төсөл рүү шилжихэд хуучин төслийн өгөгдөл
// хэсэг зуур харагдахаас сэргийлнэ.
type Keyed<T> = { id: string; data: T | null; error: string | null };

function useCachedResource<T>(
  id: string,
  cache: Map<string, T>,
  fetcher: (id: string, force?: boolean) => Promise<T>,
  errorMessage: string,
) {
  const [state, setState] = useState<Keyed<T> | null>(null);
  const current = state?.id === id ? state : null;
  const data = current?.data ?? cache.get(id) ?? null;
  const error = current?.error ?? null;

  const run = useCallback(
    async (force: boolean) => {
      try {
        const result = await fetcher(id, force);
        setState({ id, data: result, error: null });
      } catch (err) {
        setState({
          id,
          data: cache.get(id) ?? null,
          error: err instanceof Error ? err.message : errorMessage,
        });
      }
    },
    [id, cache, fetcher, errorMessage],
  );

  const refresh = useCallback(() => run(true), [run]);

  useEffect(() => {
    if (!id) return;
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа болдог тул хэвийн
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(false);
  }, [id, run]);

  return {
    data,
    // Зөвхөн харуулах өгөгдөл огт байхгүй үед л "ачаалж байна"
    loading: Boolean(id) && !data && !error,
    error,
    refresh,
  };
}

export function useProjectFolder(projectId: string): UseProjectFolderResult {
  const { data, loading, error, refresh } = useCachedResource(
    projectId,
    projectDetailCache,
    loadProjectDetail,
    "Failed to load project.",
  );

  // Файл/folder нэмэх, устгах, зөөх үед (sidebar-ийн нээлттэй төслүүд ч)
  // шинэчлэгдэнэ.
  useEffect(() => {
    if (!projectId) return;
    const onChanged = () => void refresh();
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
  }, [projectId, refresh]);

  return { project: data, loading, error, refresh };
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
  const { data, loading, error, refresh } = useCachedResource(
    fileId,
    fileDetailCache,
    loadFileDetail,
    "Failed to load file.",
  );
  return { file: data, loading, error, refresh };
}
