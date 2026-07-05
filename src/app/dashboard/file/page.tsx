"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getFilePermission,
  getFileSize,
  useProjectFile,
  useProjectFolder,
} from "@/hooks/use-project-folders";
import { useAuth } from "@/hooks/use-auth";
import type { ApiProjectFile } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { hasEditableContent } from "@/lib/editable-content";
import {
  CollaborativeEditor,
} from "@/app/editor/collaborative-editor";
import {
  LiveblocksProviderWrapper,
  LiveblocksRoom,
} from "@/app/editor/liveblocks-room";
import { CommentsPanel } from "@/components/file/comments-panel";
import { ShareDialog } from "@/components/file/share-dialog";
import {
  Check,
  ChevronLeft,
  Download,
  FileText,
  History,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  MessageSquare,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { FileInfoDialog } from "@/components/file/file-info-dialog";

export default function DashboardFilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-background p-8 text-muted-foreground">
          Loading file...
        </div>
      }
    >
      <FilePageContent />
    </Suspense>
  );
}

function FilePageContent() {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId") ?? "";
  const fileId = searchParams.get("fileId") ?? "";

  if (!fileId) {
    return <FileNotFound message="Open a file from the folder list." />;
  }

  return <FileEditor folderId={folderId} fileId={fileId} />;
}

function FileEditor({ folderId, fileId }: { folderId: string; fileId: string }) {
  const { user, loading: authLoading } = useAuth();
  const {
    project,
    loading: folderLoading,
    refresh: refreshProject,
  } = useProjectFolder(folderId);
  const {
    file,
    loading: fileLoading,
    error,
    refresh: refreshFile,
  } = useProjectFile(fileId);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);

  const initialTitle = useMemo(
    () => file?.name.replace(/\.[^.]+$/, "") ?? "Untitled document",
    [file?.name],
  );

  // Гарчиг өөрчлөгдвөл өргөтгөлийг хадгалж файлын нэрийг шинэчилнэ
  async function saveTitle(value: string) {
    if (!file) return;
    const trimmed = value.trim();
    const ext = file.name.match(/\.[^.]+$/)?.[0] ?? "";
    const nextName = `${trimmed}${ext}`;
    if (!trimmed || nextName === file.name) return;
    await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    }).catch(() => null);
  }

  if (authLoading || folderLoading || fileLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-8 text-muted-foreground">
        Loading file...
      </div>
    );
  }

  if (!user || !project || !file || error) {
    return <FileNotFound message={error ?? "Open a file from the folder list."} />;
  }

  const myRole = project.members?.find((m) => m.user?.id === user.id)?.role;
  const isOwner = user.role === "ADMIN" || myRole === "OWNER";
  const permission = getFilePermission(myRole, user.role);
  const isReference = project.visibility === "REFERENCE";
  // Өөр хүн түгжсэн бол admin-аас бусад нь зассаж чадахгүй (сервер ч 423 буцаана)
  const lockedByOther =
    file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN";
  const canEdit = !isReference && permission !== "Viewer" && !lockedByOther;
  // Lock товч: эзэн/admin түгжинэ; түгжсэн хүн нь өөрөө тайлж чадна
  const canToggleLock =
    isOwner || (file.isLocked && file.lockedById === user.id);
  // Upload хийсэн хувилбартай файлыг л татаж болно (R2-д объект байгаа)
  const hasUpload = (file.versions?.length ?? 0) > 0;
  const lowerFileName = file.name.toLowerCase();
  const isOfficeFile =
    /\.(docx?|xlsx?)$/.test(lowerFileName) ||
    file.mimeType.includes("officedocument") ||
    file.mimeType.includes("msword") ||
    file.mimeType.includes("ms-excel");
  const opensInEditor =
    !isReference && !isOfficeFile && hasEditableContent(file.content);

  // Файл түгжих/тайлах — түгжээтэй үед бусад хүний засвар сервер дээр блокдоно
  async function toggleLock() {
    if (!file) return;
    setLockBusy(true);
    try {
      const res = await fetch(`/api/files/${file.id}/lock`, {
        method: file.isLocked ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Түгжээ өөрчилж чадсангүй.");
      }
      toast.success(file.isLocked ? "Түгжээ тайлагдлаа" : "Файл түгжигдлээ");
      await refreshFile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLockBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <Link
            href={`/dashboard/project?projectId=${project.id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="size-3.5" /> {project.name}
          </Link>
          <div className="ml-2 min-w-40 flex-1">
            <input
              key={file.id}
              defaultValue={initialTitle}
              onBlur={(e) => saveTitle(e.target.value)}
              readOnly={!canEdit}
              className="w-full bg-transparent text-lg font-medium text-foreground outline-none focus:ring-0"
            />
          </div>
          {file.isLocked && (
            <span
              className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
              title={`Түгжсэн: ${file.lockedBy?.nickname || file.lockedBy?.email || "?"}`}
            >
              <Lock className="size-3" />
              {file.lockedBy?.nickname || file.lockedBy?.email || "Түгжээтэй"}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-teal" /> All changes saved
          </span>
          {canToggleLock && (
            <Button
              size="sm"
              variant="outline"
              disabled={lockBusy}
              title={file.isLocked ? "Түгжээ тайлах" : "Файл түгжих (бусдын засварыг хориглоно)"}
              onClick={toggleLock}
            >
              {lockBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : file.isLocked ? (
                <LockOpen className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            title="Хувилбар, үйл ажиллагааны түүх"
            onClick={() => setInfoOpen(true)}
          >
            <History className="size-3.5" />
          </Button>
          {hasUpload && (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/files/${file.id}/download`}>
                <Download className="mr-1.5 size-3.5" /> Download
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant={commentsOpen ? "default" : "outline"}
            className={commentsOpen ? "bg-primary text-primary-foreground" : undefined}
            onClick={() => setCommentsOpen((current) => !current)}
          >
            <MessageSquare className="mr-1.5 size-3.5" /> Comments
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="mr-1.5 size-3.5" /> Share
          </Button>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            {permission}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!opensInEditor && hasUpload ? (
            // Upload хийсэн, editor content байхгүй файл (зураг/pdf/dwg...) — preview/download
            <FilePreview file={file} />
          ) : (
            // Дотоод document болон plain text upload (.txt/.md) — collaborative editor
            <LiveblocksProviderWrapper>
              <LiveblocksRoom fileId={file.id}>
                <CollaborativeEditor
                  fileId={file.id}
                  initialContent={file.content}
                  readOnly={!canEdit}
                />
              </LiveblocksRoom>
            </LiveblocksProviderWrapper>
          )}
        </div>

        {/* Google Docs маягийн баруун талын comment panel */}
        {commentsOpen && (
          <CommentsPanel
            fileId={file.id}
            currentUserId={user.id}
            canModerate={isOwner}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </div>

      <ShareDialog
        project={project}
        fileId={file.id}
        isOwner={isOwner}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onChanged={refreshProject}
      />

      <FileInfoDialog file={file} open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
}

function FilePreview({ file }: { file: ApiProjectFile }) {
  const isImage = file.mimeType.startsWith("image/");
  const isPdf =
    file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  // Download route нь энэ файлын хамгийн сүүлийн хувилбар руу redirect хийдэг
  // тул ?inline нэмбэл attachment биш, шууд browser дотор нээгдэнэ.
  const viewUrl = `/api/files/${file.id}/download?inline=true`;
  const downloadUrl = `/api/files/${file.id}/download`;

  if (isImage) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={viewUrl}
          alt={file.name}
          className="max-h-full max-w-full rounded-xl border border-border shadow-card"
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <iframe
        src={viewUrl}
        title={file.name}
        className="flex-1 border-0"
      />
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-8">
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
        <FileText className="mx-auto size-10 text-muted-foreground" />
        <h2 className="mt-4 font-display text-xl text-primary">{file.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {getFileSize(file)} · {file.mimeType}
        </p>
        <Button asChild className="mt-5 bg-primary text-primary-foreground">
          <a href={downloadUrl}>
            <Download className="mr-2 size-4" /> Download
          </a>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Энэ төрлийн файлыг browser дотор шууд харах боломжгүй — татаж үзнэ үү.
        </p>
      </div>
    </div>
  );
}

function FileNotFound({ message }: { message: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-background p-8">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <KeyRound className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl text-primary">File not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-5 bg-primary hover:bg-primary/90">
          <Link href="/dashboard">Back to workspace</Link>
        </Button>
      </div>
    </div>
  );
}
