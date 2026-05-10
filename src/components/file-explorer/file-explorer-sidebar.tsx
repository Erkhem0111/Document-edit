// "use client";

// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
//   ChevronDown,
//   ChevronRight,
//   FileIcon,
//   FileSpreadsheet,
//   FileText,
//   Folder,
//   FolderOpen,
//   LogOut,
// } from "lucide-react";
// import { useEffect, useMemo, useState } from "react";
// import { signOut } from "next-auth/react";
// import { TlsLogo } from "@/components/brand/tls-logo";
// import { cn } from "@/lib/utils";
// import type { FileTreeNode } from "./file-tree";

// type ProjectDetail = {
//   id: string;
//   name: string;
//   files: { id: string; name: string; folder: string }[];
// };

// export function FileExplorerSidebar() {
//   const [projects, setProjects] = useState<ProjectDetail[]>([]);

//   useEffect(() => {
//     let cancelled = false;
//     async function load() {
//       const res = await fetch("/api/projects");
//       if (!res.ok || cancelled) return;
//       const data = (await res.json()) as {
//         projects: { id: string; name: string }[];
//       };
//       const details = await Promise.all(
//         data.projects.map(async (project) => {
//           const r = await fetch(`/api/projects/${project.id}`);
//           if (!r.ok) return { ...project, files: [] };
//           return ((await r.json()) as { project: ProjectDetail }).project;
//         }),
//       );
//       if (!cancelled) setProjects(details);
//     }
//     void load();
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const tree = useMemo(() => buildTree(projects), [projects]);

//   return (
//     <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
//       <div className="border-b border-sidebar-border p-5">
//         <Link href="/dashboard">
//           <TlsLogo size="sm" showText className="[&_p:first-child]:text-sidebar-foreground" />
//         </Link>
//       </div>
//       <nav className="flex-1 overflow-y-auto px-2 py-2">
//         <div className="px-2 py-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
//           Folders
//         </div>
//         {tree.map((node) => (
//           <TreeNode key={node.id} node={node} depth={0} />
//         ))}
//       </nav>
//       <div className="border-t border-sidebar-border p-4">
//         <button
//           onClick={() => signOut({ callbackUrl: "/login" })}
//           className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
//         >
//           <LogOut className="size-4" />
//           Sign out
//         </button>
//       </div>
//     </aside>
//   );
// }

// function buildTree(projects: ProjectDetail[]): FileTreeNode[] {
//   return projects.map((project) => {
//     const folders = new Map<string, ProjectDetail["files"]>();
//     project.files.forEach((file) => {
//       const key = file.folder || "General";
//       folders.set(key, [...(folders.get(key) ?? []), file]);
//     });

//     return {
//       id: project.id,
//       name: project.name,
//       type: "folder",
//       children: [...folders.entries()].map(([name, files]) => ({
//         id: `${project.id}-${name}`,
//         name,
//         type: "folder",
//         children: files.map((file) => ({
//           id: file.id,
//           name: file.name,
//           type: "file",
//         })),
//       })),
//     };
//   });
// }

// function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
//   const pathname = usePathname();
//   const active = pathname === `/editor/${node.id}`;
//   const [open, setOpen] = useState(depth < 1);

//   if (node.type === "folder") {
//     const FolderIcon = open ? FolderOpen : Folder;
//     return (
//       <div>
//         <button
//           onClick={() => setOpen((value) => !value)}
//           className="flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
//           style={{ paddingLeft: 8 + depth * 14 }}
//         >
//           {open ? (
//             <ChevronDown className="size-4" />
//           ) : (
//             <ChevronRight className="size-4" />
//           )}
//           <FolderIcon className="size-4 text-gold" />
//           <span className="truncate">{node.name}</span>
//         </button>
//         {open &&
//           node.children?.map((child) => (
//             <TreeNode key={child.id} node={child} depth={depth + 1} />
//           ))}
//       </div>
//     );
//   }

//   const Icon = getFileIcon(node.name);
//   return (
//     <Link
//       href={`/editor/${node.id}`}
//       className={cn(
//         "flex h-8 items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
//         active && "bg-sidebar-accent font-medium text-sidebar-foreground",
//       )}
//       style={{ paddingLeft: 28 + depth * 14 }}
//     >
//       <Icon.icon className={cn("size-4", Icon.color)} />
//       <span className="truncate">{node.name}</span>
//     </Link>
//   );
// }

// function getFileIcon(name: string) {
//   const lower = name.toLowerCase();
//   if (lower.endsWith(".docx") || lower.endsWith(".doc"))
//     return { icon: FileText, color: "text-teal" };
//   if (lower.endsWith(".xlsx") || lower.endsWith(".xls"))
//     return { icon: FileSpreadsheet, color: "text-teal" };
//   return { icon: FileIcon, color: "text-sidebar-foreground/60" };
// }
