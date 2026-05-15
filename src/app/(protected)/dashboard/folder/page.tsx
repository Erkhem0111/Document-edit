"use client";
import { useFolders } from "@/lib/folders-store";
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
import type { Folder } from "@/types/domain";

const FILE_ICONS = {
  doc: FileText,
  map: Map,
  report: FileBarChart,
  survey: ScanLine,
  image: ImageIcon,
} as const;

export function FolderPage({ folderId }: { folderId: string }) {
  const folders: Folder[] = useFolders();
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return null;

  const sorted = [...folder.files].sort(
    (a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt),
  );

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
              style={{ backgroundColor: folder.color }}
            />
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {folder.type} folder
            </p>
          </div>
          <h1 className="mt-2 font-display text-4xl text-primary">
            {folder.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {folder.description}
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
            const Icon = FILE_ICONS[file.type] ?? FileText;
            return (
              <Link
                key={file.id}
                href={`/dashboard/file?folderId=${folder.id}&fileId=${file.id}`}
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
                  {format(new Date(file.uploadedAt), "MMM d, yyyy")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {file.size}
                </span>
                <span className="text-xs text-muted-foreground">
                  {file.owner}
                </span>
                <span className="text-xs">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                    {file.permission}
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
  return (
    <div className="p-10">
      <p className="text-muted-foreground">Folder not found.</p>
      <Link href="/dashboard" className="mt-4 inline-block text-teal underline">
        Back to workspace
      </Link>
    </div>
  );
}

export default function DashboardFolderPage() {
  const searchParams = useSearchParams();
  const folders = useFolders();
  const folderId = searchParams.get("folderId") ?? folders[0]?.id;

  if (!folderId) return <FolderNotFoundPage />;

  return <FolderPage folderId={folderId} />;
}
