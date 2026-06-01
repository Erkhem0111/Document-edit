"use client";
import {
  getFilePermission,
  getFileSize,
  getFileType,
  getOwnerName,
  getProjectColor,
  useProjectFolder,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Upload,
  FileText,
  Map,
  FileBarChart,
  Image as ImageIcon,
  ScanLine,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const FILE_ICONS = {
  doc: FileText,
  map: Map,
  report: FileBarChart,
  survey: ScanLine,
  image: ImageIcon,
  file: FileText,
} as const;

export function FolderPage({ folderId }: { folderId: string }) {
  const { user, loading: authLoading } = useAuth();
  const { project, loading, error } = useProjectFolder(folderId);
  if (authLoading || loading) return <FolderLoadingPage />;
  if (!user) return <FolderEmptyState message="Sign in required." />;
  if (error || !project) {
    return <FolderEmptyState message={error ?? "Folder not found."} />;
  }

  const sorted = [...(project.files ?? [])].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  const color = getProjectColor();

  return (
    <div className="px-10 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Workspace
      </Link>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Project workspace
            </p>
          </div>
          <h1 className="mt-2 font-display text-4xl text-primary">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description ?? "Project workspace"}
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground">
          <Upload className="mr-2 h-4 w-4" /> Upload file
        </Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="grid grid-cols-[1fr_140px_100px_140px_120px] border-b border-border bg-muted/40 px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Name</span>
          <span>Uploaded</span>
          <span>Size</span>
          <span>Owner</span>
          <span>Permission</span>
        </div>
        {sorted.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No files in this folder yet.
          </div>
        ) : (
          sorted.map((file) => {
            const Icon = FILE_ICONS[getFileType(file)] ?? FileText;
            return (
              <Link
                key={file.id}
                href={`/dashboard/file?folderId=${project.id}&fileId=${file.id}`}
                className="grid grid-cols-[1fr_140px_100px_140px_120px] items-center border-b border-border/60 px-5 py-3 text-sm transition hover:bg-accent/40 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-teal">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground truncate">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(file.createdAt), "MMM d, yyyy")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getFileSize(file)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getOwnerName(file)}
                </span>
                <span className="text-xs">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                    {getFilePermission(file, user.id)}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export function FolderNotFoundPage() {
  return <FolderEmptyState message="Folder not found." />;
}

function FolderLoadingPage() {
  return <FolderEmptyState message="Loading folder..." />;
}

function FolderEmptyState({ message }: { message: string }) {
  return (
    <div className="p-10">
      <p className="text-muted-foreground">{message}</p>
      <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
        Back to workspace
      </Link>
    </div>
  );
}

export default function DashboardFolderPage() {
  const searchParams = useSearchParams();
  const requestedFolderId = searchParams.get("folderId");
  const { projects, loading } = useProjectFolders();
  const folderId = requestedFolderId ?? projects[0]?.id;

  if (loading && !folderId) return <FolderLoadingPage />;
  if (!folderId) return <FolderNotFoundPage />;

  return <FolderPage folderId={folderId} />;
}
