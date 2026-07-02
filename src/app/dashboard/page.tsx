"use client";

import { useProjectFolders } from "@/hooks/use-project-folders";
import { FOLDERS, getProjectFolderKey, type FolderDef } from "@/lib/folders";
import Link from "next/link";

export default function DashboardHomePage() {
  const { projects, loading, error } = useProjectFolders();

  // Project бүрийг folder key-гээр нь бүлэглэж тоолно
  function countIn(folder: FolderDef) {
    return projects.filter((p) => getProjectFolderKey(p) === folder.key).length;
  }

  return (
    <div className="px-10 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-teal">
          Workspace
        </p>
        <h1 className="mt-1 font-display text-4xl text-primary">Your folders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Файлуудаа хандалтын горимоор нь ангилж хадгална.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FOLDERS.map((folder) => (
          <FolderCard
            key={folder.key}
            folder={folder}
            count={countIn(folder)}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  count,
  loading,
}: {
  folder: FolderDef;
  count: number;
  loading: boolean;
}) {
  const Icon = folder.icon;
  return (
    <Link
      href={`/dashboard/folder?key=${folder.key}`}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <div
        className="absolute right-0 top-0 h-24 w-24 rounded-bl-3xl opacity-10 transition group-hover:opacity-20"
        style={{ backgroundColor: folder.color }}
      />
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in oklch, ${folder.color} 16%, transparent)`,
          color: folder.color,
        }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-display text-xl text-primary">{folder.label}</h3>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {folder.description}
      </p>
      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>{loading ? "…" : `${count} folders`}</span>
        <span className="font-medium text-foreground/70 group-hover:text-primary">
          Open -&gt;
        </span>
      </div>
    </Link>
  );
}
