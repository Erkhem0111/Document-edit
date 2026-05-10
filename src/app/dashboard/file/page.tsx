"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getFile, getFolder, getFolders } from "@/lib/folders-store";
import { Button } from "@/components/ui/button";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronLeft,
  Image as ImageIcon,
  Italic,
  KeyRound,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  Share2,
  Underline,
  type LucideIcon,
} from "lucide-react";

export default function DashboardFilePage() {
  const searchParams = useSearchParams();
  const fallbackFolder = getFolders()[0];
  const folderId = searchParams.get("folderId") ?? fallbackFolder?.id ?? "";
  const fileId = searchParams.get("fileId") ?? getFolder(folderId)?.files[0]?.id ?? "";

  return <FileEditor folderId={folderId} fileId={fileId} />;
}

function FileEditor({ folderId, fileId }: { folderId: string; fileId: string }) {
  const folder = getFolder(folderId);
  const file = getFile(folderId, fileId);
  const initialTitle = useMemo(
    () => file?.name.replace(/\.[^.]+$/, "") ?? "Untitled document",
    [file?.name],
  );
  const [title, setTitle] = useState(initialTitle);

  if (!folder || !file) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background p-8">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <KeyRound className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl text-primary">File not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open a file from the dashboard folder list.
          </p>
          <Button asChild className="mt-5 bg-primary hover:bg-primary/90">
            <Link href="/dashboard">Back to workspace</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="border-b border-border bg-card">
        <div className="flex items-center gap-3 px-6 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ChevronLeft className="size-3.5" /> {folder.name}
          </Link>
          <div className="ml-2 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-lg font-medium text-foreground outline-none focus:ring-0"
            />
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-teal" /> All changes saved
          </span>
          <Button size="sm" variant="outline">
            <MessageSquare className="mr-1.5 size-3.5" /> Comments
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground">
            <Share2 className="mr-1.5 size-3.5" /> Share
          </Button>
        </div>

        <div className="flex items-center gap-1 border-t border-border px-6 py-2">
          <ToolbarBtn icon={Bold} />
          <ToolbarBtn icon={Italic} />
          <ToolbarBtn icon={Underline} />
          <Sep />
          <ToolbarBtn icon={AlignLeft} />
          <ToolbarBtn icon={AlignCenter} />
          <ToolbarBtn icon={AlignRight} />
          <Sep />
          <ToolbarBtn icon={List} />
          <ToolbarBtn icon={ListOrdered} />
          <Sep />
          <ToolbarBtn icon={Link2} />
          <ToolbarBtn icon={ImageIcon} />
          <div className="ml-auto text-xs text-muted-foreground">
            <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
              {file.permission}
            </span>
            <span className="ml-2">Owned by {file.owner}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-8 py-12">
        <div className="min-h-[700px] rounded-2xl border border-border bg-card p-12 shadow-card">
          <h1 className="font-display text-3xl text-primary">{title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {folder.name} · {file.size} · Last modified by {file.owner}
          </p>
          <div
            className="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground"
            contentEditable
            suppressContentEditableWarning
          >
            <p>
              <strong>Project Overview.</strong> This survey covers parcel boundaries, elevation
              contours, and reference points captured with dual-frequency GNSS receivers.
              Coordinates use ITRF2014 epoch 2024.5, projected to UTM Zone 36N.
            </p>
            <p>
              Field measurements were verified against three control monuments with residuals
              below 8 mm horizontal and 12 mm vertical. Closure checks confirm a relative accuracy
              of 1:25,000.
            </p>
            <h2 className="mt-8 font-display text-2xl text-primary">Methodology</h2>
            <p>
              Static GNSS sessions were post-processed against CORS network base data. Total-station
              traverses were tied to GNSS-derived coordinates and adjusted by least squares.
            </p>
            <h2 className="mt-8 font-display text-2xl text-primary">Deliverables</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Boundary plan (PDF + DWG)</li>
              <li>Topographic surface (1 m contours)</li>
              <li>GNSS observation log and adjustment report</li>
              <li>Final coordinate list (CSV)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <button className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
      <Icon className="size-4" />
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}
