"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { signOut } from "next-auth/react";
import { useFolders } from "@/lib/folders-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  LogOut,
  Upload,
  HardDrive,
  Globe2,
  Users,
  Lock,
  Archive,
  BookOpen,
  Trash2,
  Folder as FolderIcon,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  public: Globe2,
  shared: Users,
  private: Lock,
  archive: Archive,
  reference: BookOpen,
  trash: Trash2,
  custom: FolderIcon,
};

function SidebarFolder({
  folder,
  active,
}: {
  folder: ReturnType<typeof useFolders>[number];
  active: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const open = active || manualOpen;
  const Icon = ICONS[folder.type] ?? FolderIcon;

  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md ${active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"}`}
      >
        <button
          onClick={() => setManualOpen((o) => !o)}
          className="p-1.5 text-sidebar-foreground/60"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <Link
          // href={`/dashboard/folder/${folder.id}`}
          href={`/dashboard/folder/`}
          className="flex flex-1 items-center gap-2 py-1.5 pr-2 text-sm"
        >
          <Icon className="h-3.5 w-3.5" style={{ color: folder.color }} />
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto text-[10px] text-sidebar-foreground/40">
            {folder.files.length}
          </span>
        </Link>
      </div>
      {open && (
        <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-5 ml-3">
          {folder.files.length === 0 && (
            <li className="py-1 text-[11px] text-sidebar-foreground/40">
              Empty
            </li>
          )}
          {folder.files.map((file) => (
            <li key={file.id}>
              <Link
                href={`/dashboard/file/${folder.id}/${file.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{file.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RightPanel() {
  const folders = useFolders();
  const [q, setQ] = useState("");
  const totalFiles = folders.reduce((acc, f) => acc + f.files.length, 0);
  const used = 32.4;
  const total = 50;
  const pct = (used / total) * 100;

  const matches = q.trim()
    ? folders.flatMap((f) =>
        f.files
          .filter((fl) => fl.name.toLowerCase().includes(q.toLowerCase()))
          .map((fl) => ({ f, fl })),
      )
    : [];

  return (
    <aside className="border-l border-border bg-card/40 p-5 overflow-y-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search files…"
          className="pl-9 bg-background"
        />
      </div>
      {q && (
        <div className="mt-3 space-y-1">
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">
              No files match.
            </p>
          ) : (
            matches.slice(0, 8).map(({ f, fl }) => (
              <Link
                key={fl.id}
                href={`/dashboard/file/${f.id}/${fl.id}`}
                className="block rounded-md p-2 text-xs hover:bg-accent"
              >
                <div className="font-medium text-foreground truncate">
                  {fl.name}
                </div>
                <div className="text-muted-foreground">{f.name}</div>
              </Link>
            ))
          )}
        </div>
      )}
      <div className="mt-6">
        <p className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          At a glance
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">Folders</div>
            <div className="font-display text-2xl text-primary">
              {folders.length}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-[10px] text-muted-foreground">Files</div>
            <div className="font-display text-2xl text-primary">
              {totalFiles}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto" />
      <div className="mt-6 rounded-xl border border-border bg-background p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-teal" />
          <div className="text-sm font-medium">Storage</div>
          <div className="ml-auto text-xs text-muted-foreground">
            {used} / {total} GB
          </div>
        </div>
        <Progress value={pct} className="mt-3 h-1.5" />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {pct < 70
            ? "Plenty of space remaining."
            : pct < 90
              ? "Filling up — review archives."
              : "Almost full."}
        </p>
        <Button variant="outline" size="sm" className="mt-3 w-full">
          <Upload className="mr-1 h-3.5 w-3.5" /> Upload file
        </Button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const folders = useFolders();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr_300px] bg-background">
      <aside className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ backgroundColor: "var(--gold)" }}
            >
              <span className="font-display text-sm text-primary">T</span>
            </div>
            <div>
              <div className="text-sm font-medium text-sidebar-foreground">
                Terra Line
              </div>
              <div className="text-[10px] tracking-widest uppercase text-sidebar-foreground/50">
                Workspace
              </div>
            </div>
          </Link>
        </div>

        <div className="px-3 py-4">
          <div className="px-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            Folders
          </div>
          <ul className="mt-2 space-y-0.5">
            {folders.map((f) => (
              <SidebarFolder
                key={f.id}
                folder={f}
                active={pathname.includes(`/folder/${f.id}`)}
              />
            ))}
          </ul>
        </div>

        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm">
              {user.email!.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user.email}</div>
              <div className="text-[10px] text-sidebar-foreground/50">
                Signed in
              </div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="overflow-y-auto">{children}</main>

      <RightPanel />
    </div>
  );
}
