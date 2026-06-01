"use client";

import { useState } from "react";
import {
  getProjectColor,
  useProjectFolders,
} from "@/hooks/use-project-folders";
import type { ApiProject } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Folder as FolderIcon, Plus } from "lucide-react";
import Link from "next/link";

export default function DashboardHomePage() {
  const { projects, loading, error, refresh } = useProjectFolders();

  async function createProject(name: string) {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      throw new Error(body?.message ?? "Failed to create project.");
    }
    await refresh();
  }

  return (
    <div className="px-10 py-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-teal">
            Workspace
          </p>
          <h1 className="mt-1 font-display text-4xl text-primary">
            Your folders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize survey files, reports and reference material.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading folders...
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
            {error}
          </div>
        )}
        {projects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            color={getProjectColor(index)}
          />
        ))}
        <CreateFolderCard onCreate={createProject} />
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  color,
}: {
  project: ApiProject;
  color: string;
}) {
  return (
    <Link
      href={`/dashboard/folder?folderId=${project.id}`}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
    >
      <div
        className="absolute right-0 top-0 h-24 w-24 rounded-bl-3xl opacity-10 transition group-hover:opacity-20"
        style={{ backgroundColor: color }}
      />
      <div
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
          color,
        }}
      >
        <FolderIcon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-display text-xl text-primary">
        {project.name}
      </h3>
      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>{project._count?.files ?? 0} files</span>
        <span className="font-medium text-foreground/70 group-hover:text-primary">
          Open -&gt;
        </span>
      </div>
    </Link>
  );
}

function CreateFolderCard({
  onCreate,
}: {
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function reset() {
    setName("");
  }

  async function create() {
    if (!name.trim()) {
      toast.error("Name your folder first");
      return;
    }
    try {
      await onCreate(name.trim());
      toast.success(`"${name}" created`);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Project creation failed");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-6 text-muted-foreground transition hover:border-teal hover:bg-card hover:text-primary">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
            <Plus className="h-5 w-5" />
          </div>
          <div className="mt-4 font-display text-lg">Add Folder</div>
          <div className="text-xs">Create a new project space</div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            New folder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label htmlFor="fname">Folder name</Label>
            <Input
              id="fname"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Folder name"
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={create}
            className="bg-primary text-primary-foreground"
          >
            Create folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
