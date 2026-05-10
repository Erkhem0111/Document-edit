"use client";
import { useState } from "react";
import { useFolders, addFolder } from "@/lib/folders-store";
import { FOLDER_COLORS, TEAM_USERS } from "@/app/mock-data";
import type { Folder } from "@/app/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Globe2,
  Users,
  Lock,
  Archive,
  BookOpen,
  Trash2,
  Folder as FolderIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const ICONS: Record<string, LucideIcon> = {
  public: Globe2,
  shared: Users,
  private: Lock,
  archive: Archive,
  reference: BookOpen,
  trash: Trash2,
  custom: FolderIcon,
};

export default function DashboardHomePage() {
  const folders = useFolders();
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
        {folders.map((folder) => (
          <FolderCard key={folder.id} folder={folder} />
        ))}
        <CreateFolderCard />
      </div>
    </div>
  );
}

function FolderCard({ folder }: { folder: Folder }) {
  const Icon = ICONS[folder.type] ?? FolderIcon;
  return (
    <Link
      href={`/dashboard/folder/${folder.id}`}
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
      <h3 className="mt-5 font-display text-xl text-primary">{folder.name}</h3>
      {/* <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
        {folder.description}
      </p> */}
      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>{folder.files.length} files</span>
        <span className="font-medium text-foreground/70 group-hover:text-primary">
          Open →
        </span>
      </div>
    </Link>
  );
}

function CreateFolderCard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0].value);
  const [visibility, setVisibility] = useState("shared");
  const [query, setQuery] = useState("");
  const [invited, setInvited] = useState<typeof TEAM_USERS>([]);

  const showSuggestions = query.startsWith("@") || query.length > 1;
  const suggestions = TEAM_USERS.filter(
    (u) =>
      !invited.find((i) => i.id === u.id) &&
      (query.replace("@", "").trim() === "" ||
        u.name.toLowerCase().includes(query.replace("@", "").toLowerCase()) ||
        u.email.toLowerCase().includes(query.replace("@", "").toLowerCase())),
  );

  function reset() {
    setName("");
    setColor(FOLDER_COLORS[0].value);
    setVisibility("shared");
    setQuery("");
    setInvited([]);
  }

  function create() {
    if (!name.trim()) {
      toast.error("Name your folder first");
      return;
    }
    addFolder({
      id: `c-${Date.now()}`,
      name: name.trim(),
      description:
        visibility === "private"
          ? "Only you can access these files."
          : "Custom folder",
      type: "custom",
      color,
      files: [],
    });
    toast.success(`"${name}" created`);
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
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
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition ${color === c.value ? "border-primary scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c.value }}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  Public — everyone in the company
                </SelectItem>
                <SelectItem value="shared">
                  Shared — only invited people
                </SelectItem>
                <SelectItem value="private">Private — just me</SelectItem>
                <SelectItem value="reference">Reference — view-only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Invite users</Label>
            <div className="mt-1.5 rounded-md border border-input bg-background p-2">
              {invited.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {invited.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs"
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[9px] text-teal-foreground">
                        {u.name[0]}
                      </span>
                      {u.name}
                      <button
                        onClick={() =>
                          setInvited(invited.filter((i) => i.id !== u.id))
                        }
                        className="ml-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Type "@" to mention a teammate'
                className="border-0 shadow-none focus-visible:ring-0 p-0 h-7"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-popover">
                  {suggestions.slice(0, 6).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setInvited([...invited, u]);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal text-xs text-teal-foreground">
                        {u.name[0]}
                      </span>
                      <div>
                        <div className="font-medium text-foreground">
                          {u.name}
                        </div>
                        <div className="text-muted-foreground">{u.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
