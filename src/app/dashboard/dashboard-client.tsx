"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; nickname: string | null; role: string };
type Project = { id: string; name: string; _count: { files: number; tasks: number; members: number } };
type Member = { user: { id: string; email: string; nickname: string | null } };
type FileItem = {
  id: string;
  name: string;
  folder: string;
  isLocked: boolean;
  uploader: { nickname: string | null; email: string };
  versions: { fileSize: string; versionNumber: number }[];
  _count: { comments: number; versions: number };
};
type ProjectDetail = Project & { files: FileItem[]; members: Member[] };
type FolderGroup = { name: string; files: FileItem[] };

function displayName(user: User | { nickname: string | null; email: string }) {
  return user.nickname || user.email;
}

function formatBytes(value?: string) {
  const bytes = Number(value ?? 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes || 0} B`;
}

function defaultFolderName(name: string) {
  const lower = name.toLowerCase();
  if (/\.(docx?|pdf|txt)$/.test(lower)) return "Documents";
  if (/\.(xlsx?|csv)$/.test(lower)) return "Spreadsheets";
  if (/\.(dwg|dxf|ifc|rvt)$/.test(lower)) return "Engineering";
  return "Other";
}

export function DashboardClient({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [activeFolder, setActiveFolder] = useState("");
  const [selectedFileId, setSelectedFileId] = useState("");
  const [query, setQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [panel, setPanel] = useState<"info" | "settings" | "notifications">("info");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileValue, setUploadFileValue] = useState<File | null>(null);
  const [folderName, setFolderName] = useState("Documents");
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const [editorIds, setEditorIds] = useState<string[]>([]);

  const files = useMemo(() => detail?.files ?? [], [detail]);
  const folders = useMemo(() => groupFiles(files), [files]);
  const selectedFolder = folders.find((folder) => folder.name === activeFolder) ?? null;
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? selectedFolder?.files[0] ?? files[0] ?? null;
  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = selectedFolder?.files ?? [];
    return source.filter((file) => !q || file.name.toLowerCase().includes(q));
  }, [query, selectedFolder]);

  async function loadProjects() {
    const res = await fetch("/api/projects");
    if (!res.ok) return;
    const data = (await res.json()) as { projects: Project[] };
    setProjects(data.projects);
    setSelectedProjectId((current) => current || data.projects[0]?.id || "");
  }

  async function loadProject(id: string) {
    if (!id) return setDetail(null);
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { project: ProjectDetail };
    setDetail(data.project);
    setActiveFolder((current) => current || data.project.files[0]?.folder || "");
    setSelectedFileId((current) => current || data.project.files[0]?.id || "");
  }

  async function createProject() {
    if (!projectName.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { project: Project };
    setProjectName("");
    setProjects((items) => [data.project, ...items]);
    setSelectedProjectId(data.project.id);
  }

  async function uploadFile() {
    if (!uploadFileValue || !selectedProjectId || !folderName.trim()) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFileValue);
    formData.append("folder", folderName.trim());
    formData.append("viewerIds", viewerIds.join(","));
    formData.append("editorIds", editorIds.join(","));
    formData.append("commitMsg", `Uploaded to ${folderName.trim()}`);
    await fetch(`/api/projects/${selectedProjectId}/files`, { method: "POST", body: formData });
    setUploading(false);
    setUploadOpen(false);
    setUploadFileValue(null);
    setActiveFolder(folderName.trim());
    await loadProject(selectedProjectId);
  }

  function openUpload(folder = activeFolder || "Documents") {
    setFolderName(folder);
    setViewerIds(detail?.members.map((member) => member.user.id) ?? []);
    setEditorIds([initialUser.id]);
    setUploadOpen(true);
  }

  useEffect(() => { queueMicrotask(() => void loadProjects()); }, []);
  useEffect(() => { queueMicrotask(() => void loadProject(selectedProjectId)); }, [selectedProjectId]);

  return (
    <main className="flex h-screen overflow-hidden bg-[#f6f7f8] text-[#20242a]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[#e3e6ea] bg-white">
        <Brand />
        <nav className="flex-1 overflow-y-auto px-3 py-3 text-sm">
          <SideItem icon={Home} label="Home" onClick={() => setActiveFolder(folders[0]?.name ?? "")} />
          <SideItem icon={FolderOpen} label="Projects" active onClick={() => setActiveFolder(folders[0]?.name ?? "")} />
          <ProjectList projects={projects} activeId={selectedProjectId} onSelect={(id) => { setSelectedProjectId(id); setActiveFolder(""); }} />
          <FolderTree folders={folders} active={activeFolder} onFolder={setActiveFolder} onFile={(id) => router.push(`/editor/${id}`)} />
        </nav>
        <div className="space-y-1 border-t border-[#edf0f2] p-3 text-sm">
          <SideItem icon={Settings} label="Settings" onClick={() => setPanel("settings")} />
          <SideItem icon={Bell} label="Notifications" badge="10" onClick={() => setPanel("notifications")} />
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded-[6px] px-2 py-2 hover:bg-[#f7f8f9]">
            <LogOut className="size-4" /> {displayName(initialUser)}
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <Header
          projectName={detail?.name ?? "Workspace"}
          folderName={activeFolder}
          menuOpen={menuOpen}
          onMenu={() => setMenuOpen((value) => !value)}
          onRefresh={() => void loadProject(selectedProjectId)}
          onSettings={() => setPanel("settings")}
          onUpload={() => openUpload("")}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa1a9]" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files" className="h-9 rounded-[8px] border-[#e1e5e9] bg-white pl-9" />
              </div>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="New project" className="h-9 max-w-44" />
              <Button size="icon" variant="outline" onClick={createProject}><Plus className="size-4" /></Button>
              <Button variant="outline" onClick={() => openUpload(activeFolder)} className="ml-auto h-9"><Upload className="size-4" /> Upload</Button>
            </div>

            {!activeFolder ? (
              <FolderCards folders={folders} onFolder={setActiveFolder} onUpload={openUpload} />
            ) : (
              <FileList files={visibleFiles} selectedId={selectedFileId} onSelect={setSelectedFileId} onOpen={(id) => router.push(`/editor/${id}`)} />
            )}
          </div>
          <RightPanel panel={panel} file={selectedFile} user={initialUser} onPanel={setPanel} />
        </div>
      </section>

      {uploadOpen && (
        <UploadDialog
          file={uploadFileValue}
          folderName={folderName}
          members={detail?.members ?? []}
          viewerIds={viewerIds}
          editorIds={editorIds}
          uploading={uploading}
          onFile={(file) => { setUploadFileValue(file); if (file && !folderName.trim()) setFolderName(defaultFolderName(file.name)); }}
          onFolder={setFolderName}
          onViewers={setViewerIds}
          onEditors={setEditorIds}
          onClose={() => setUploadOpen(false)}
          onSubmit={() => void uploadFile()}
        />
      )}
    </main>
  );
}

function groupFiles(files: FileItem[]) {
  const map = new Map<string, FileItem[]>();
  files.forEach((file) => map.set(file.folder || "General", [...(map.get(file.folder || "General") ?? []), file]));
  return [...map.entries()].map(([name, groupedFiles]) => ({ name, files: groupedFiles }));
}

function Header({ projectName, folderName, menuOpen, onMenu, onRefresh, onSettings, onUpload }: { projectName: string; folderName: string; menuOpen: boolean; onMenu: () => void; onRefresh: () => void; onSettings: () => void; onUpload: () => void }) {
  return (
    <header className="relative flex h-14 items-center gap-2 border-b border-[#edf0f2] bg-white px-5">
      <span className="text-sm text-[#8a9199]">Projects</span><span className="text-[#c4c8cc]">/</span><span className="text-sm font-semibold">{projectName}</span>
      {folderName && <><span className="text-[#c4c8cc]">/</span><span className="text-sm">{folderName}</span></>}
      <div className="ml-auto flex items-center gap-2"><Button size="sm" onClick={onUpload} className="bg-[#20242a] hover:bg-[#343a42]">New folder upload</Button><Button variant="ghost" size="icon" onClick={onMenu}><MoreHorizontal className="size-4" /></Button></div>
      {menuOpen && <div className="absolute right-5 top-12 z-10 w-40 rounded-[8px] border bg-white p-1 text-sm shadow-lg"><button onClick={onRefresh} className="w-full rounded-[6px] px-3 py-2 text-left hover:bg-[#f7f8f9]">Refresh</button><button onClick={onSettings} className="w-full rounded-[6px] px-3 py-2 text-left hover:bg-[#f7f8f9]">Settings</button></div>}
    </header>
  );
}

function ProjectList({ projects, activeId, onSelect }: { projects: Project[]; activeId: string; onSelect: (id: string) => void }) {
  return <div className="ml-5 border-l border-[#e5e7eb] pl-2">{projects.map((project) => <button key={project.id} onClick={() => onSelect(project.id)} className={cn("block w-full truncate rounded-[6px] px-2 py-1.5 text-left text-xs", activeId === project.id ? "bg-[#f1f3f5] font-semibold" : "hover:bg-[#f7f8f9]")}>{project.name}</button>)}</div>;
}

function FolderTree({ folders, active, onFolder, onFile }: { folders: FolderGroup[]; active: string; onFolder: (name: string) => void; onFile: (id: string) => void }) {
  return <div className="mt-3 space-y-1">{folders.map((folder) => <FolderTreeItem key={folder.name} folder={folder} active={active === folder.name} onFolder={onFolder} onFile={onFile} />)}</div>;
}

function FolderTreeItem({ folder, active, onFolder, onFile }: { folder: FolderGroup; active: boolean; onFolder: (name: string) => void; onFile: (id: string) => void }) {
  const [open, setOpen] = useState(active);
  return <div><button onClick={() => { setOpen((value) => !value); onFolder(folder.name); }} className={cn("flex w-full items-center gap-2 rounded-[6px] px-2 py-2 text-left", active && "bg-[#f1f3f5] font-semibold")} >{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}<FolderOpen className="size-4 text-[#b88926]" /><span className="truncate">{folder.name}</span></button>{open && <div className="ml-7 space-y-1 border-l border-[#edf0f2] pl-2">{folder.files.map((file) => <button key={file.id} onClick={() => onFile(file.id)} className="block w-full truncate rounded-[6px] px-2 py-1.5 text-left text-xs hover:bg-[#f7f8f9]">{file.name}</button>)}</div>}</div>;
}

function FolderCards({ folders, onFolder, onUpload }: { folders: FolderGroup[]; onFolder: (name: string) => void; onUpload: (name: string) => void }) {
  if (!folders.length) return <EmptyState onUpload={() => onUpload("Documents")} />;
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{folders.map((folder, index) => <button key={folder.name} onClick={() => onFolder(folder.name)} className={cn("relative min-h-44 overflow-hidden rounded-[16px] border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", index === 1 ? "border-[#7fb3ff] bg-[#71a9ff] text-white" : "border-[#e1e5e9] bg-white text-[#20242a]")}><div className={cn("absolute left-5 right-5 top-5 h-16 rounded-t-[18px] bg-[#f5f6f7]", index === 1 && "bg-white/25")} /><div className={cn("absolute left-5 top-5 h-6 w-24 rounded-t-[14px] bg-[#edf0f2]", index === 1 && "bg-white/35")} /><div className="relative mt-20"><p className="truncate text-sm font-semibold">{folder.name}</p><p className={cn("mt-1 text-xs", index === 1 ? "text-white/80" : "text-[#69717a]")}>{folder.files.length} files</p><p className={cn("mt-4 text-xs", index === 1 ? "text-white/80" : "text-[#9aa1a9]")}>Open folder</p></div></button>)}</div>;
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return <div className="rounded-[12px] border border-dashed bg-white p-10 text-center"><p className="font-semibold">No folders yet</p><p className="mt-1 text-sm text-[#69717a]">Create a folder by uploading the first file into it.</p><Button onClick={onUpload} className="mt-4 bg-[#20242a] hover:bg-[#343a42]">Upload first file</Button></div>;
}

function FileList({ files, selectedId, onSelect, onOpen }: { files: FileItem[]; selectedId: string; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  if (!files.length) return <div className="rounded-[12px] border border-dashed bg-white p-10 text-center text-sm text-[#69717a]">This folder has no files.</div>;
  return <div className="overflow-hidden rounded-[12px] border bg-white"><div className="grid grid-cols-[1fr_120px_120px] border-b bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase text-[#69717a]"><span>Name</span><span>Version</span><span>Size</span></div>{files.map((file) => <button key={file.id} onClick={() => { onSelect(file.id); onOpen(file.id); }} className={cn("grid w-full grid-cols-[1fr_120px_120px] items-center px-4 py-3 text-left text-sm hover:bg-[#f8fafc]", selectedId === file.id && "bg-[#eef6ff]")}><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 text-[#2563eb]" /><span className="truncate font-medium">{file.name}</span></span><span>v{file.versions[0]?.versionNumber ?? 0}</span><span>{formatBytes(file.versions[0]?.fileSize)}</span></button>)}</div>;
}

function UploadDialog({ file, folderName, members, viewerIds, editorIds, uploading, onFile, onFolder, onViewers, onEditors, onClose, onSubmit }: { file: File | null; folderName: string; members: Member[]; viewerIds: string[]; editorIds: string[]; uploading: boolean; onFile: (file: File | null) => void; onFolder: (name: string) => void; onViewers: (ids: string[]) => void; onEditors: (ids: string[]) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-xl rounded-[12px] bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="font-semibold">Upload into project folder</p><p className="text-sm text-[#69717a]">{file?.name ?? "Choose a file"}</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button></div><label className="mb-4 block rounded-[10px] border border-dashed p-4 text-center text-sm hover:bg-[#f8fafc]"><Upload className="mx-auto mb-2 size-5" />{file ? file.name : "Choose file"}<input type="file" className="hidden" onChange={(event) => onFile(event.target.files?.[0] ?? null)} /></label><label className="mb-4 block text-sm font-medium">Folder name<Input value={folderName} onChange={(event) => onFolder(event.target.value)} className="mt-2 h-10" placeholder="e.g. Survey documents" /></label><AccessPicker title="Can view" icon={Eye} members={members} ids={viewerIds} onChange={onViewers} /><AccessPicker title="Can edit" icon={FileText} members={members} ids={editorIds} onChange={onEditors} /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onSubmit} disabled={uploading || !file || !folderName.trim()} className="bg-[#20242a] hover:bg-[#343a42]">{uploading ? "Uploading..." : "Save to database"}</Button></div></div></div>;
}

function AccessPicker({ title, icon: Icon, members, ids, onChange }: { title: string; icon: React.ElementType; members: Member[]; ids: string[]; onChange: (ids: string[]) => void }) {
  return <div className="mb-4"><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[#69717a]"><Icon className="size-4" /> {title}</p><div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">{members.map((member) => { const checked = ids.includes(member.user.id); return <label key={member.user.id} className="flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={() => onChange(checked ? ids.filter((id) => id !== member.user.id) : [...ids, member.user.id])} /><span className="truncate">{member.user.nickname || member.user.email}</span></label>; })}</div></div>;
}

function Brand() {
  return <div className="flex h-14 items-center gap-2 px-4"><div className="flex size-8 items-center justify-center rounded-[8px] bg-[#20242a] text-xs font-bold text-white">TLS</div><span className="font-semibold">Terra Line</span></div>;
}

function SideItem({ icon: Icon, label, active, badge, onClick }: { icon: React.ElementType; label: string; active?: boolean; badge?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-[6px] px-2 py-2", active ? "font-semibold text-[#20242a]" : "text-[#5f6872] hover:bg-[#f7f8f9]")}><Icon className="size-4" /><span>{label}</span>{badge && <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{badge}</span>}</button>;
}

function RightPanel({ panel, file, user, onPanel }: { panel: "info" | "settings" | "notifications"; file: FileItem | null; user: User; onPanel: (panel: "info" | "settings" | "notifications") => void }) {
  return <aside className="hidden w-80 shrink-0 border-l border-[#edf0f2] bg-white p-5 xl:block"><div className="mb-6 flex items-center justify-between"><h2 className="text-sm font-semibold">{panel === "info" ? "Info" : panel === "settings" ? "Settings" : "Notifications"}</h2><button onClick={() => onPanel("info")} className="text-[#9aa1a9]">»</button></div>{panel === "settings" ? <SettingsPanel user={user} /> : panel === "notifications" ? <NotificationsPanel /> : <InfoPanel file={file} />}</aside>;
}

function InfoPanel({ file }: { file: FileItem | null }) {
  return <><InfoCard title="Documents" value={file ? formatBytes(file.versions[0]?.fileSize) : "0 B"} color="bg-[#71a9ff]" /><InfoCard title="Versions" value={`${file?._count.versions ?? 0}`} color="bg-[#ef4444]" /><div className="mt-6"><p className="mb-3 text-xs font-semibold uppercase text-[#69717a]">Properties</p><InfoRow label="Name" value={file?.name ?? "-"} /><InfoRow label="Folder" value={file?.folder ?? "-"} /><InfoRow label="Owner" value={file ? displayName(file.uploader) : "-"} /><InfoRow label="Status" value={file?.isLocked ? "Locked" : "Unlocked"} /></div></>;
}

function SettingsPanel({ user }: { user: User }) {
  return <div className="space-y-3 text-sm"><InfoRow label="User" value={displayName(user)} /><InfoRow label="Role" value={user.role} /><Button variant="outline" className="w-full" onClick={() => window.location.reload()}>Reload workspace</Button></div>;
}

function NotificationsPanel() {
  return <div className="space-y-3 text-sm text-[#69717a]"><p className="rounded-[8px] bg-[#f6f8fa] p-3">Folder uploads and edits appear here.</p><p className="rounded-[8px] bg-[#f6f8fa] p-3">Files inherit access from upload folder selection.</p></div>;
}

function InfoCard({ title, value, color }: { title: string; value: string; color: string }) {
  return <div className="mb-4 rounded-[8px] border border-[#edf0f2] p-4"><p className="text-xs text-[#69717a]">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p><div className="mt-3 h-1.5 rounded-full bg-[#eef1f4]"><div className={cn("h-full w-3/4 rounded-full", color)} /></div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="mb-2 flex justify-between gap-4 text-xs"><span className="text-[#8a9199]">{label}</span><span className="truncate font-medium">{value}</span></div>;
}
