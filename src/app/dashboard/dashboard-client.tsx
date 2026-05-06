"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Download,
  FileLock,
  FileText,
  FolderKanban,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Unlock,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  members: { role: string }[];
  _count: { files: number; tasks: number; members: number };
};

type ProjectDetail = Project & {
  files: ProjectFile[];
  tasks: Task[];
};

type ProjectFile = {
  id: string;
  name: string;
  mimeType: string;
  isLocked: boolean;
  lockedAt: string | null;
  openMode: "browser" | "external" | "download";
  lockedBy: { nickname: string | null; email: string } | null;
  uploader: { nickname: string | null; email: string };
  versions: { id: string; versionNumber: number; fileSize: string; createdAt: string }[];
  _count: { comments: number; versions: number };
};

type Comment = {
  id: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  user: { nickname: string | null; email: string };
  replies?: Comment[];
};

type Task = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee: { nickname: string | null; email: string };
};

const statusLabels: Record<Task["status"], string> = {
  TODO: "Хүлээгдэж буй",
  IN_PROGRESS: "Хийгдэж байна",
  IN_REVIEW: "Шалгалт",
  DONE: "Дууссан",
};

function formatBytes(value?: string) {
  const bytes = Number(value ?? 0);
  if (!bytes) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function displayName(user?: { nickname: string | null; email: string }) {
  return user?.nickname || user?.email || "Unknown";
}

export function DashboardClient({ initialUser }: { initialUser: User }) {
  const [user] = useState(initialUser);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [query, setQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const selectedFile = useMemo(
    () => projectDetail?.files.find((file) => file.id === selectedFileId) ?? null,
    [projectDetail, selectedFileId],
  );

  const filteredFiles = useMemo(() => {
    const files = projectDetail?.files ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return files;
    return files.filter((file) => file.name.toLowerCase().includes(normalized));
  }, [projectDetail, query]);

  const loadProjects = async () => {
    setError("");
    const res = await fetch("/api/projects");
    if (!res.ok) {
      setError("Төслүүд татахад алдаа гарлаа.");
      setLoading(false);
      return;
    }

    const data = (await res.json()) as { projects: Project[] };
    setProjects(data.projects);
    setSelectedProjectId((current) => current || data.projects[0]?.id || "");
    setLoading(false);
  };

  const loadProjectDetail = async (projectId: string) => {
    if (!projectId) {
      setProjectDetail(null);
      return;
    }

    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) {
      setError("Төслийн мэдээлэл татахад алдаа гарлаа.");
      return;
    }

    const data = (await res.json()) as { project: ProjectDetail };
    setProjectDetail(data.project);
    setSelectedFileId((current) => {
      if (data.project.files.some((file) => file.id === current)) return current;
      return data.project.files[0]?.id || "";
    });
  };

  const loadComments = async (fileId: string) => {
    if (!fileId) {
      setComments([]);
      return;
    }

    const res = await fetch(`/api/files/${fileId}/comments`);
    if (!res.ok) return;
    const data = (await res.json()) as { comments: Comment[] };
    setComments(data.comments);
  };

  useEffect(() => {
    queueMicrotask(() => void loadProjects());
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadProjectDetail(selectedProjectId));
  }, [selectedProjectId]);

  useEffect(() => {
    queueMicrotask(() => void loadComments(selectedFileId));
    const timer = window.setInterval(() => void loadComments(selectedFileId), 5000);
    return () => window.clearInterval(timer);
  }, [selectedFileId]);

  const createProject = async () => {
    if (!projectName.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    if (!res.ok) return setError("Төсөл үүсгэж чадсангүй.");
    const data = (await res.json()) as { project: Project };
    setProjectName("");
    setProjects((items) => [data.project, ...items]);
    setSelectedProjectId(data.project.id);
  };

  const uploadFile = async (file?: File) => {
    if (!file || !selectedProjectId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("commitMsg", "Initial upload");

    const res = await fetch(`/api/projects/${selectedProjectId}/files`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!res.ok) return setError("Файл upload хийхэд алдаа гарлаа.");
    await loadProjectDetail(selectedProjectId);
  };

  const addVersion = async (file?: File) => {
    if (!file || !selectedFileId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("commitMsg", "Updated from workspace");

    const res = await fetch(`/api/files/${selectedFileId}/versions`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!res.ok) return setError("Шинэ version upload хийж чадсангүй.");
    await loadProjectDetail(selectedProjectId);
  };

  const toggleLock = async () => {
    if (!selectedFile) return;
    const res = await fetch(`/api/files/${selectedFile.id}/lock`, {
      method: selectedFile.isLocked ? "DELETE" : "POST",
    });
    if (!res.ok) return setError("Lock төлөв өөрчилж чадсангүй.");
    await loadProjectDetail(selectedProjectId);
  };

  const openFile = async (file: ProjectFile) => {
    const res = await fetch(`/api/files/${file.id}/download`);
    if (!res.ok) return setError("Файл нээх холбоос үүссэнгүй.");
    const data = (await res.json()) as { url: string };
    if (file.openMode === "browser") {
      setPreviewUrl(data.url);
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const addComment = async () => {
    if (!selectedFileId || !commentText.trim()) return;
    const res = await fetch(`/api/files/${selectedFileId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText }),
    });
    if (!res.ok) return setError("Comment илгээж чадсангүй.");
    setCommentText("");
    await loadComments(selectedFileId);
  };

  const createTask = async () => {
    if (!selectedProjectId || !taskTitle.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId, title: taskTitle }),
    });
    if (!res.ok) return setError("Task үүсгэж чадсангүй.");
    setTaskTitle("");
    await loadProjectDetail(selectedProjectId);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">
            G
          </div>
          <div>
            <h1 className="text-base font-semibold">GeoDoc Workspace</h1>
            <p className="text-xs text-slate-500">Survey, CAD, document control</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {displayName(user)} · {user.role}
          </span>
          <Button variant="outline" size="sm" onClick={() => void loadProjectDetail(selectedProjectId)}>
            <RefreshCw />
            Refresh
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="border-b bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center gap-2">
            <FolderKanban className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold">Projects</h2>
          </div>
          <div className="flex gap-2">
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Шинэ төсөл"
            />
            <Button size="icon" onClick={createProject}>
              <Plus />
            </Button>
          </div>
          <div className="mt-4 space-y-1">
            {loading ? (
              <p className="text-sm text-slate-500">Уншиж байна...</p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                    selectedProjectId === project.id
                      ? "bg-slate-950 text-white"
                      : "hover:bg-slate-100",
                  )}
                >
                  <span className="block truncate font-medium">{project.name}</span>
                  <span className="text-xs opacity-70">
                    {project._count.files} files · {project._count.members} members
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-w-0 p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2.5 top-2 size-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="Файл хайх"
              />
            </div>
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white">
              <Upload className="size-4" />
              {uploading ? "Uploading" : "Upload"}
              <input
                type="file"
                className="hidden"
                onChange={(event) => void uploadFile(event.target.files?.[0])}
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-[42%] px-3 py-2">Файл</th>
                  <th className="px-3 py-2">Төлөв</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="w-24 px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredFiles.map((file) => (
                  <tr
                    key={file.id}
                    className={cn(
                      "cursor-pointer hover:bg-slate-50",
                      selectedFileId === file.id && "bg-sky-50",
                    )}
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-slate-500" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="text-xs text-slate-500">
                            {file.openMode === "external"
                              ? "AutoCAD/engineering app"
                              : file.openMode === "browser"
                                ? "Website preview"
                                : "Download"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-md px-2 py-1 text-xs", file.isLocked ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                        {file.isLocked ? `Locked · ${displayName(file.lockedBy ?? undefined)}` : "Unlocked"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      v{file.versions[0]?.versionNumber ?? 0} · {formatBytes(file.versions[0]?.fileSize)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{displayName(file.uploader)}</td>
                    <td className="px-3 py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openFile(file);
                        }}
                      >
                        <Download />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filteredFiles.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">
                      Энэ төсөлд файл алга.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {previewUrl && (
            <div className="mt-4 overflow-hidden rounded-lg border bg-white">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className="text-sm font-medium">Preview</p>
                <Button variant="ghost" size="sm" onClick={() => setPreviewUrl("")}>
                  Хаах
                </Button>
              </div>
              <iframe src={previewUrl} className="h-[520px] w-full bg-white" />
            </div>
          )}
        </section>

        <aside className="border-t bg-white p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">
                {selectedFile?.name ?? "Файл сонгоно уу"}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedFile ? `${selectedFile._count.comments} comments · ${selectedFile._count.versions} versions` : "Comment болон lock энд харагдана"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={toggleLock} disabled={!selectedFile}>
              {selectedFile?.isLocked ? <Unlock /> : <FileLock />}
            </Button>
          </div>

          <label className="mt-4 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium hover:bg-slate-50">
            <Upload className="size-4" />
            New version
            <input
              type="file"
              className="hidden"
              disabled={!selectedFile}
              onChange={(event) => void addVersion(event.target.files?.[0])}
            />
          </label>

          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="size-4 text-slate-500" />
              <h3 className="text-sm font-semibold">Comments</h3>
            </div>
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              className="min-h-20 w-full resize-none rounded-lg border bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Comment бичих"
              disabled={!selectedFile}
            />
            <Button className="mt-2 w-full" onClick={addComment} disabled={!selectedFile}>
              Илгээх
            </Button>
            <div className="mt-4 space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">{displayName(comment.user)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
                  {comment.isEdited && <p className="mt-1 text-xs text-slate-400">edited</p>}
                </div>
              ))}
              {!comments.length && (
                <p className="text-sm text-slate-500">Comment алга.</p>
              )}
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Tasks</h3>
            <div className="flex gap-2">
              <Input
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Шинэ task"
              />
              <Button size="icon" onClick={createTask}>
                <Plus />
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {(projectDetail?.tasks ?? []).slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-lg border px-3 py-2">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {statusLabels[task.status]} · {task.priority}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
