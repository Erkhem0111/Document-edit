"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiFileRow, ApiProject, ApiProjectFile, ProjectRole } from "@/types/domain";

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

// Нэг өөрчлөлтийн дараа refresh() + notifyProjectsChanged() + бусад сонсогчид
// бараг зэрэг дуудагддаг. Ийм "force" дуудлагууд саяхан (DEDUPE_MS дотор) эхэлсэн
// хүсэлтийг хуваалцана — гэхдээ хэрэглэгчийн дараагийн өөрчлөлт (жишээ нь 2 дахь
// файл устгах) ямагт шинэ хүсэлт гаргана, хуучин өгөгдөл харуулахгүй.
const DEDUPE_MS = 150;
let projectListStartedAt = 0;

async function loadProjectList(force = false): Promise<ApiProject[]> {
  if (projectListRequest && (!force || Date.now() - projectListStartedAt < DEDUPE_MS)) {
    return projectListRequest;
  }

  projectListStartedAt = Date.now();
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
        error instanceof Error ? error.message : "Folder-уудыг ачаалж чадсангүй.";
      throw error;
    })
    .finally(() => {
      projectListRequest = null;
    });

  return projectListRequest;
}

// Ижил төслийн force дуудлагууд DEDUPE_MS дотор эхэлсэн хүсэлтийг хуваалцана
const projectStartedAt = new Map<string, number>();

async function loadProjectDetail(projectId: string, force = false): Promise<ApiProject> {
  const existing = projectDetailRequests.get(projectId);
  const recent = Date.now() - (projectStartedAt.get(projectId) ?? 0) < DEDUPE_MS;
  if (existing && (!force || recent)) return existing;
  const cached = projectDetailCache.get(projectId);
  if (force && cached && recent) return cached;

  projectStartedAt.set(projectId, Date.now());

  const request = readJson<{ project: ApiProject }>(`/api/projects/${projectId}`, {
    force,
    ttlMs: 15000,
  })
    .then((data) => {
      projectDetailCache.set(projectId, data.project);
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
export function getFileSize(file: { versions?: Array<{ fileSize: string }> }): string {
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

// Хэрэглэгчийн энэ төсөл дээрх эрх. Сервер (myRole) тооцсон бол түүнийг —
// клиент дүрмийг дахин бичихгүй. Хуучин кэштэй өгөгдөлд нөөц тооцоо.
export function myProjectRole(
  project: ApiProject,
  user: { id: string; role?: string } | null | undefined,
): ProjectRole | undefined {
  if (project.myRole !== undefined) return project.myRole ?? undefined;
  if (!user) return undefined;
  const members = project.members ?? [];
  const raw =
    members.find((m) => m.user?.id === user.id)?.role ??
    (members.length === 1 && !members[0].user ? members[0].role : undefined);
  if (project.visibility === "PRIVATE") return raw === "OWNER" ? "OWNER" : undefined;
  return user.role === "ADMIN" ? "OWNER" : raw;
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
        throw new Error(body?.message ?? "Мэдээлэл ачаалж чадсангүй.");
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
// useProjectFolders (зүүн sidebar г.м.) жагсаалтаа дахин ачаална.
// Ингэснээр sidebar хуучирсан (устгагдсан) файл харуулахгүй.
//
// projectIds өгвөл зөвхөн тэдгээр төслийн дэлгэрэнгүй, файлын жагсаалт дахин
// ачаалагдана (sidebar-д нээлттэй бусад төслүүд хүсэлт гаргахгүй). Өгөхгүй бол
// бүгд шинэчлэгдэнэ — аль төсөлд нөлөөлснийг мэдэхгүй үед аюулгүй сонголт.
export const PROJECTS_CHANGED_EVENT = "tls:projects-changed";

type ProjectsChangedDetail = { projectIds?: string[] };

export function notifyProjectsChanged(projectIds?: Array<string | null | undefined>) {
  if (typeof window === "undefined") return;
  const ids = projectIds?.filter((id): id is string => Boolean(id));
  markProjectsStale(ids && ids.length > 0 ? ids : null);
  window.dispatchEvent(
    new CustomEvent<ProjectsChangedDetail>(PROJECTS_CHANGED_EVENT, {
      detail: ids && ids.length > 0 ? { projectIds: ids } : {},
    }),
  );
}

// Одоо дэлгэцэнд байхгүй (unmount болсон) хавтас, төслийн кэшийг "хуучирсан"
// гэж тэмдэглэнэ: дараа нээхэд кэшээ шууд харуулаад ар талд нь шинэчилнэ.
// Эс бөгөөс өөр хавтас руу зөөсөн файл тэр хавтсанд 15 секунд харагдахгүй байж болно.
function markProjectsStale(ids: string[] | null) {
  const hit = (projectId: string) => !ids || ids.includes(projectId);
  for (const [key, value] of dirFilesCache) {
    if (hit(key.slice(0, key.indexOf(":")))) dirFilesCache.set(key, { ...value, fetchedAt: 0 });
  }
  for (const url of httpCache.keys()) {
    const match = /^\/api\/projects\/([^/?]+)$/.exec(url);
    if (match && hit(match[1])) httpCache.delete(url);
  }
}

function affectsProject(event: Event, projectId: string) {
  const ids = (event as CustomEvent<ProjectsChangedDetail | null>).detail?.projectIds;
  return !ids || ids.includes(projectId);
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
      setError(err instanceof Error ? err.message : "Folder-уудыг ачаалж чадсангүй.");
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
      setError(err instanceof Error ? err.message : "Folder-уудыг ачаалж чадсангүй.");
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
    "Төслийг ачаалж чадсангүй.",
  );

  // Файл/folder нэмэх, устгах, зөөх үед (sidebar-ийн нээлттэй төслүүд ч)
  // шинэчлэгдэнэ.
  useEffect(() => {
    if (!projectId) return;
    const onChanged = (event: Event) => {
      if (affectsProject(event, projectId)) void refresh();
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
  }, [projectId, refresh]);

  return { project: data, loading, error, refresh };
}

// ─── Хавтасны файлууд (хуудаслалттай) ────────────────────────────────────────
// Төслийн хуудас болон sidebar ижил түлхүүрээр (төсөл + хавтас) нэг кэш,
// нэг хүсэлтийг хуваалцана. Эхний хуудсыг харуулаад "Цааш" дарвал дараагийнхыг
// нэмж ачаална. Өөрчлөлтийн дараа ачаалсан хэмжээгээрээ (500 хүртэл) шинэчилнэ —
// хэрэглэгчийн "Цааш" дарж нээсэн файлууд алга болохгүй.

export const DIR_FILES_PAGE = 100;
const DIR_FILES_MAX = 500;
const DIR_FILES_FRESH_MS = 15000;

type DirFiles = { files: ApiFileRow[]; nextCursor: string | null; fetchedAt: number };

const dirFilesCache = new Map<string, DirFiles>();
const dirFilesRequests = new Map<string, { promise: Promise<DirFiles>; startedAt: number }>();
// Түлхүүр бүрийн "үе" — шинэчлэлт бүрт нэмэгдэнэ. Хуучин үеийн хариу
// (удаан ирсэн хүсэлт, хуучин курсорын "Цааш") шинэ өгөгдлийг дарахгүй.
const dirFilesGeneration = new Map<string, number>();

function dirFilesKey(projectId: string, dir: string | null) {
  return `${projectId}:${dir ?? ""}`;
}

class ListChangedError extends Error {}

async function fetchDirPage(
  projectId: string,
  dir: string | null,
  limit: number,
  cursor?: string | null,
): Promise<{ files: ApiFileRow[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ dir: dir ?? "root", limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/projects/${projectId}/files?${params}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = body?.message ?? "Файлуудыг ачаалж чадсангүй.";
    throw response.status === 409 ? new ListChangedError(message) : new Error(message);
  }
  return (await response.json()) as { files: ApiFileRow[]; nextCursor: string | null };
}

async function loadDirFiles(
  projectId: string,
  dir: string | null,
  force: boolean,
  extra = 0,
): Promise<DirFiles> {
  const key = dirFilesKey(projectId, dir);
  const cached = dirFilesCache.get(key);
  const inflight = dirFilesRequests.get(key);
  if (inflight && (!force || Date.now() - inflight.startedAt < DEDUPE_MS)) return inflight.promise;
  if (!force && cached && Date.now() - cached.fetchedAt < DIR_FILES_FRESH_MS) return cached;

  const generation = (dirFilesGeneration.get(key) ?? 0) + 1;
  dirFilesGeneration.set(key, generation);
  const limit = Math.min(
    Math.max((cached?.files.length ?? 0) + extra, DIR_FILES_PAGE),
    DIR_FILES_MAX,
  );

  const promise = fetchDirPage(projectId, dir, limit)
    .then((page) => {
      // Энэ хооронд шинэ хүсэлт эхэлсэн бол түүний үр дүнг хүлээнэ
      if (dirFilesGeneration.get(key) !== generation) {
        return dirFilesRequests.get(key)?.promise ?? dirFilesCache.get(key) ?? { ...page, fetchedAt: Date.now() };
      }
      const result: DirFiles = { ...page, fetchedAt: Date.now() };
      dirFilesCache.set(key, result);
      return result;
    })
    .finally(() => {
      if (dirFilesRequests.get(key)?.promise === promise) dirFilesRequests.delete(key);
    });

  dirFilesRequests.set(key, { promise, startedAt: Date.now() });
  return promise;
}

export function useDirFiles(projectId: string, dir: string | null) {
  const key = projectId ? dirFilesKey(projectId, dir) : "";
  const [state, setState] = useState<{ key: string; data: DirFiles | null; error: string | null } | null>(null);
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
  const current = state?.key === key ? state : null;
  const data = current?.data ?? (key ? dirFilesCache.get(key) ?? null : null);
  const error = current?.error ?? null;

  const run = useCallback(
    async (force: boolean, extra = 0) => {
      if (!projectId) return;
      try {
        const result = await loadDirFiles(projectId, dir, force, extra);
        setState({ key, data: result, error: null });
      } catch (err) {
        setState({
          key,
          data: dirFilesCache.get(key) ?? null,
          error: err instanceof Error ? err.message : "Файлуудыг ачаалж чадсангүй.",
        });
      }
    },
    [projectId, dir, key, setState],
  );

  const refresh = useCallback(() => run(true), [run]);

  const loadMore = useCallback(async () => {
    const base = dirFilesCache.get(key);
    if (!projectId || !base?.nextCursor || loadingMoreKey === key) return;
    const generation = dirFilesGeneration.get(key);
    setLoadingMoreKey(key);
    try {
      const page = await fetchDirPage(projectId, dir, DIR_FILES_PAGE, base.nextCursor);
      // Энэ хооронд жагсаалт шинэчлэгдсэн бол хуучин курсорын хуудсыг хаяна
      if (dirFilesGeneration.get(key) !== generation) return;
      const latest = dirFilesCache.get(key) ?? base;
      const seen = new Set(latest.files.map((f) => f.id));
      const merged: DirFiles = {
        files: [...latest.files, ...page.files.filter((f) => !seen.has(f.id))],
        nextCursor: page.nextCursor,
        fetchedAt: latest.fetchedAt,
      };
      dirFilesCache.set(key, merged);
      setState({ key, data: merged, error: null });
    } catch (err) {
      // Курсор хүчингүй болсон (файл устсан, зөөгдсөн) — эхнээс нь, харуулж
      // байсан тоо + дараагийн хуудсаар дахин ачаална ("Цааш" дарсан нь хэрэгжинэ)
      if (err instanceof ListChangedError) await run(true, DIR_FILES_PAGE);
      else setState({ key, data: dirFilesCache.get(key) ?? null, error: err instanceof Error ? err.message : "Файлуудыг ачаалж чадсангүй." });
    } finally {
      setLoadingMoreKey((k) => (k === key ? null : k));
    }
  }, [projectId, dir, key, loadingMoreKey, run, setState, setLoadingMoreKey]);

  useEffect(() => {
    if (!projectId) return;
    // fetch-on-mount — setState нь зөвхөн await-ийн дараа болдог тул хэвийн
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(false);
    const onChanged = (event: Event) => {
      if (affectsProject(event, projectId)) void run(true);
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
  }, [projectId, run]);

  return {
    files: data?.files ?? [],
    hasMore: Boolean(data?.nextCursor),
    loading: Boolean(projectId) && !data && !error,
    loadingMore: loadingMoreKey === key,
    error,
    loadMore,
    refresh,
  };
}

// ─── Төслүүдийн эзлэх хэмжээ (хавтасны жагсаалтын хуудсанд л) ───────────────
export function useProjectSizes(): Record<string, string> | null {
  const [sizes, setSizes] = useState<Record<string, string> | null>(null);

  const load = useCallback(async (force: boolean) => {
    try {
      const data = await readJson<{ sizes: Record<string, string> }>("/api/projects?sizes=1", {
        force,
        ttlMs: 60000,
      });
      setSizes(data.sizes);
    } catch {
      // хэмжээ заавал биш — "—" харуулна
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChanged = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(true), STORAGE_REFRESH_DELAY_MS);
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  return sizes;
}

export type StorageInfo = {
  usedBytes: string;
  quotaBytes: string;
  // PRIVATE / SHARED / PUBLIC / REFERENCE / TRASH → bytes
  byCategory?: Record<string, string>;
  topFiles?: Array<{
    id: string;
    name: string;
    mimeType: string;
    projectId: string;
    projectName: string;
    visibility: string;
    size: string;
  }>;
};

const STORAGE_REFRESH_DELAY_MS = 3000;

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
    // Өөрчлөлт бүрд шууд биш — дараалсан өөрчлөлтүүдийг (олон файл оруулах г.м.)
    // нэгтгээд 3 секундийн дараа нэг л удаа шинэчилнэ. Ашиглалтын тоо яаралтай биш.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChanged = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), STORAGE_REFRESH_DELAY_MS);
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  return data;
}

export function useProjectFile(fileId: string): UseProjectFileResult {
  const { data, loading, error, refresh } = useCachedResource(
    fileId,
    fileDetailCache,
    loadFileDetail,
    "Файлыг ачаалж чадсангүй.",
  );
  return { file: data, loading, error, refresh };
}
