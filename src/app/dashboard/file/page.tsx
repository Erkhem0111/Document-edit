"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getFilePermission,
  getFileSize,
  notifyProjectsChanged,
  useProjectFile,
  useProjectFolder,
} from "@/hooks/use-project-folders";
import { useAuth } from "@/hooks/use-auth";
import type { ApiProjectFile } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { FileEditorSkeleton } from "@/components/skeletons";
import { hasEditableContent } from "@/lib/editable-content";
import {
  CollaborativeEditor,
  type SaveStatus,
} from "@/app/editor/collaborative-editor";
import {
  LiveblocksProviderWrapper,
  LiveblocksRoom,
} from "@/app/editor/liveblocks-room";
import { CommentsPanel } from "@/components/file/comments-panel";
import { ShareDialog } from "@/components/file/share-dialog";
import {
  Check,
  ChevronDown,
  CloudOff,
  Eye,
  Download,
  FileText,
  FolderInput,
  History,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  MessageSquare,
  MoreVertical,
  Pencil,
  Printer,
  Share2,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileTypeIcon } from "@/components/file/file-type-icon";
import { MoveFileDialog } from "@/components/project/move-file-dialog";

// Баримтад оруулсан зургууд хадгалагдах хавтас (төсөл бүрийн root-д)
const IMAGES_FOLDER = "Баримтын зургууд";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { FileInfoDialog } from "@/components/file/file-info-dialog";

export default function DashboardFilePage() {
  return (
    <Suspense fallback={<FileEditorSkeleton />}>
      <FilePageContent />
    </Suspense>
  );
}

function FilePageContent() {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId") ?? "";
  const fileId = searchParams.get("fileId") ?? "";

  if (!fileId) {
    return <FileNotFound message="Folder-ийн жагсаалтаас файл нээнэ үү." />;
  }

  return <FileEditor folderId={folderId} fileId={fileId} />;
}

function FileEditor({ folderId, fileId }: { folderId: string; fileId: string }) {
  const { user, loading: authLoading } = useAuth();
  const {
    file,
    loading: fileLoading,
    error,
    refresh: refreshFile,
  } = useProjectFile(fileId);
  // Эрх, breadcrumb, хуваалцах холбоосыг URL-ийн folderId биш файлын жинхэнэ
  // төслөөс авна (файл зөөгдсөн эсвэл хуучин холбоосоор орсон үед зөрөхгүй)
  const {
    project,
    loading: folderLoading,
    refresh: refreshProject,
  } = useProjectFolder(file?.projectId || folderId);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  // Экспортод ашиглах editor (зөвхөн browser-д засагддаг баримт дээр)
  const [docEditor, setDocEditor] = useState<Editor | null>(null);
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<"edit" | "view">("edit");
  const [moveOpen, setMoveOpen] = useState(false);
  const router = useRouter();

  const initialTitle = useMemo(
    () => file?.name.replace(/\.[^.]+$/, "") ?? "Нэргүй баримт",
    [file?.name],
  );

  // Гарчиг өөрчлөгдвөл өргөтгөлийг хадгалж файлын нэрийг шинэчилнэ
  async function saveTitle(value: string) {
    if (!file) return;
    const trimmed = value.trim();
    const ext = file.name.match(/\.[^.]+$/)?.[0] ?? "";
    const nextName = `${trimmed}${ext}`;
    if (!trimmed || nextName === file.name) return;
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Нэр хадгалж чадсангүй.");
      }
      // Sidebar, folder жагсаалт шинэ нэрийг харуулна
      notifyProjectsChanged();
      await refreshFile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Нэр хадгалж чадсангүй.");
    }
  }

  if (
    authLoading ||
    folderLoading ||
    fileLoading ||
    (file && project && project.id !== file.projectId)
  ) {
    return <FileEditorSkeleton />;
  }

  if (!user || !project || !file || error) {
    return <FileNotFound message={error ?? "Folder-ийн жагсаалтаас файл нээнэ үү."} />;
  }

  const myRole = project.members?.find((m) => m.user?.id === user.id)?.role;
  const isOwner = user.role === "ADMIN" || myRole === "OWNER";
  const permission = getFilePermission(myRole, user.role);
  const isReference = project.visibility === "REFERENCE";
  // Өөр хүн түгжсэн бол admin-аас бусад нь зассаж чадахгүй (сервер ч 423 буцаана)
  const lockedByOther =
    file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN";
  // Компанийн санд зөвхөн эзэн/админ засна, бусад нь уншина
  const canEdit = (isReference ? isOwner : permission !== "Viewer") && !lockedByOther;
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
  const opensInEditor = !isOfficeFile && hasEditableContent(file.content);

  async function exportWord() {
    if (!docEditor || !file) return;
    setExporting(true);
    try {
      const { exportToDocx } = await import("@/lib/export-document");
      await exportToDocx(docEditor.getJSON(), file.name.replace(/\.[^.]+$/, "") || file.name);
    } catch {
      toast.error("Word файл үүсгэж чадсангүй.");
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    if (!docEditor || !file) return;
    const { printDocument } = await import("@/lib/export-document");
    if (!printDocument(docEditor.getHTML(), file.name)) {
      toast.error("Шинэ цонх нээгдсэнгүй. Browser-ийн popup хориглолтыг шалгана уу.");
    }
  }

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

  // Зураг: төслийн "Баримтын зургууд" хавтсанд R2 руу ачаалж, src буцаана
  async function uploadImage(image: File): Promise<string | null> {
    if (!project) return null;
    if (image.size > 10 * 1024 * 1024) {
      toast.error(`"${image.name}" хэт том байна (10MB хүртэл).`);
      return null;
    }
    const toastId = toast.loading("Зураг оруулж байна…");
    try {
      let folderId = project.folders?.find((f) => f.name === IMAGES_FOLDER && !f.parentId)?.id;
      if (!folderId) {
        const res = await fetch(`/api/projects/${project.id}/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: IMAGES_FOLDER }),
        });
        const data = (await res.json().catch(() => null)) as { folder?: { id: string } } | null;
        if (!res.ok || !data?.folder) throw new Error("Хавтас үүсгэж чадсангүй.");
        folderId = data.folder.id;
        void refreshProject();
      }
      const form = new FormData();
      form.append("file", image);
      form.append("folderId", folderId);
      const res = await fetch(`/api/projects/${project.id}/files`, { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as { file?: { id: string }; message?: string } | null;
      if (!res.ok || !data?.file) throw new Error(data?.message ?? "Зураг оруулж чадсангүй.");
      toast.dismiss(toastId);
      return `/api/files/${data.file.id}/download?inline=true&embed=1`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Зураг оруулж чадсангүй.", { id: toastId });
      return null;
    }
  }

  async function deleteFile() {
    if (!file || !project) return;
    if (!window.confirm(`"${file.name}"-ийг бүр мөсөн устгах уу? Буцаах боломжгүй.`)) return;
    const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      toast.error(body?.message ?? "Устгаж чадсангүй.");
      return;
    }
    toast.success("Устгагдлаа");
    notifyProjectsChanged();
    router.push(`/dashboard/project?projectId=${project.id}`);
  }

  const showEditor = opensInEditor || !(hasUpload || isOfficeFile);
  const viewing = mode === "view";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* ── Толгой: Google Docs шиг нэг мөр ── */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-2 px-3 py-2 md:gap-3 md:px-5">
          <Link
            href={`/dashboard/project?projectId=${project.id}`}
            title={`“${project.name}” руу буцах`}
            className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-accent"
          >
            <FileTypeIcon name={file.name} mimeType={file.mimeType} />
          </Link>
          <div className="min-w-0 flex-1">
            <input
              key={file.id}
              // Шинэ (нэргүй) баримт нээгдэхэд шууд нэр бичих боломжтой
              autoFocus={canEdit && initialTitle === "Нэргүй баримт"}
              onFocus={(e) => {
                if (initialTitle === "Нэргүй баримт") e.currentTarget.select();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Баримтын нэр"
              defaultValue={initialTitle}
              onBlur={(e) => saveTitle(e.target.value)}
              readOnly={!canEdit}
              className="-ml-1 w-full max-w-xl truncate rounded px-1 text-[17px] text-foreground outline-none hover:ring-1 hover:ring-border focus:ring-2 focus:ring-teal/40"
            />
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Link href={`/dashboard/project?projectId=${project.id}`} className="truncate hover:text-foreground">
                {project.name}
              </Link>
              {showEditor && (
                <>
                  <span aria-hidden>·</span>
                  <SaveIndicator status={canEdit ? saveStatus : "readonly"} />
                </>
              )}
              {file.isLocked && (
                <span
                  className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-px text-[11px] text-destructive"
                  title={`Түгжсэн: ${file.lockedBy?.nickname || file.lockedBy?.email || "?"}`}
                >
                  <Lock className="size-3" /> Түгжээтэй
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            title="Сэтгэгдэл"
            className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${
              commentsOpen ? "bg-teal/15 text-teal" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <MessageSquare className="size-[18px]" />
          </button>

          {showEditor && canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-foreground hover:bg-accent sm:flex"
                >
                  {viewing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
                  {viewing ? "Харах" : "Засварлах"}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => setMode("edit")} className="items-start">
                  <Pencil className="mt-0.5" />
                  <span>
                    <span className="block">Засварлах</span>
                    <span className="block text-xs text-muted-foreground">Баримтыг шууд засна</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setMode("view")} className="items-start">
                  <Eye className="mt-0.5" />
                  <span>
                    <span className="block">Харах</span>
                    <span className="block text-xs text-muted-foreground">Санамсаргүй өөрчлөхгүйгээр уншина</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            className="h-9 shrink-0 rounded-full bg-primary px-4 text-primary-foreground"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Хуваалцах</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Бусад үйлдэл"
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {exporting || lockBusy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-[18px]" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {docEditor && (
                <>
                  <DropdownMenuItem onSelect={() => void exportWord()}>
                    <FileText /> Word (.docx) татах
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportPdf()}>
                    <Printer /> PDF / Хэвлэх
                  </DropdownMenuItem>
                </>
              )}
              {hasUpload && !opensInEditor && (
                <DropdownMenuItem asChild>
                  <a href={`/api/files/${file.id}/download`}>
                    <Download /> Татах
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setInfoOpen(true)}>
                <History /> Хувилбар, түүх
              </DropdownMenuItem>
              {canToggleLock && (
                <DropdownMenuItem onSelect={() => void toggleLock()}>
                  {file.isLocked ? <LockOpen /> : <Lock />}
                  {file.isLocked ? "Түгжээ тайлах" : "Түгжих (бусад засахгүй)"}
                </DropdownMenuItem>
              )}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
                    <FolderInput /> Өөр газар зөөх
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => void deleteFile()}>
                    <Trash2 /> Устгах
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!showEditor ? (
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
                  viewing={viewing}
                  onUploadImage={canEdit ? uploadImage : undefined}
                  onSaveStatusChange={setSaveStatus}
                  onEditorReady={setDocEditor}
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
        key={project.id}
        project={project}
        fileId={file.id}
        isOwner={isOwner}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onChanged={refreshProject}
      />

      <FileInfoDialog file={file} open={infoOpen} onOpenChange={setInfoOpen} />
      {moveOpen && (
        <MoveFileDialog
          files={[{ id: file.id, name: file.name }]}
          currentProjectId={project.id}
          open={moveOpen}
          onOpenChange={setMoveOpen}
          onMoved={async () => {
            notifyProjectsChanged();
            await refreshFile();
          }}
        />
      )}
    </div>
  );
}

function FilePreview({ file }: { file: ApiProjectFile }) {
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const isWord = file.name.toLowerCase().endsWith(".docx");
  const isImage = file.mimeType.startsWith("image/");

  // Word (.docx) → засварлах боломжтой баримт (шинэ файл үүснэ)
  async function convertToDocument() {
    setConverting(true);
    try {
      const res = await fetch(`/api/files/${file.id}/convert`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { file?: { id: string; projectId: string }; message?: string }
        | null;
      if (!res.ok || !data?.file) throw new Error(data?.message ?? "Хөрвүүлж чадсангүй.");
      notifyProjectsChanged();
      toast.success("Засварлах баримт үүслээ");
      router.push(`/dashboard/file?folderId=${data.file.projectId}&fileId=${data.file.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хөрвүүлж чадсангүй.");
      setConverting(false);
    }
  }
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
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {isWord && (
            <Button
              className="bg-primary text-primary-foreground"
              disabled={converting}
              onClick={() => void convertToDocument()}
            >
              {converting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileText className="mr-2 size-4" />
              )}
              Засварлах баримт болгох
            </Button>
          )}
          <Button asChild variant={isWord ? "outline" : "default"} className={isWord ? undefined : "bg-primary text-primary-foreground"}>
            <a href={downloadUrl}>
              <Download className="mr-2 size-4" /> Татах
            </a>
          </Button>
        </div>
        <p className="mt-3 max-w-sm text-xs text-muted-foreground">
          {isWord
            ? "Word файлыг энд шууд засах боломжтой баримт болгож хувиргана. Анхны файл хэвээр үлдэнэ."
            : "Энэ төрлийн файлыг browser дотор шууд харах боломжгүй — татаж үзнэ үү."}
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
        <h1 className="mt-4 font-display text-2xl text-primary">Файл олдсонгүй</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-5 bg-primary hover:bg-primary/90">
          <Link href="/dashboard">Workspace руу буцах</Link>
        </Button>
      </div>
    </div>
  );
}

// Google Docs шиг: бичих үед "Хадгалж байна…", дууссаны дараа "Хадгалагдсан"
function SaveIndicator({ status }: { status: SaveStatus | "readonly" }) {
  if (status === "readonly") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" /> Зөвхөн унших
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-destructive"
        title="Сүүлийн өөрчлөлт серверт хадгалагдаагүй байна. Холболтоо шалгана уу."
      >
        <CloudOff className="size-3.5" /> Хадгалж чадсангүй
      </span>
    );
  }
  if (status === "saving" || status === "unsaved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" /> Хадгалж байна…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <Check className="size-3.5 text-teal" /> Хадгалагдсан
    </span>
  );
}
