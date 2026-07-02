import {
  Globe,
  Users,
  Lock,
  BookMarked,
  Archive,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ProjectVisibility } from "@/types/domain";

// ─── Тогтмол 6 folder ─────────────────────────────────────────────────────────
// Эдгээр folder DB-д мөр болж хадгалагдахгүй — код дотор тогтмол байна.
// Хэн ч нэвтэрхэд үргэлж бэлэн, өнгө + icon-оор ялгарч харагдана.
// Project бүр аль folder-т хамаарах нь visibility + isArchived + trashedAt-аар тодорхойлогдоно.

export type FolderKey = ProjectVisibility | "ARCHIVE" | "TRASH";

export interface FolderDef {
  key: FolderKey;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  // visibility — project үүсгэхэд сонгож болно
  // lifecycle  — зөвхөн төлөв (Archive/Trash руу зөөгдөнө)
  kind: "visibility" | "lifecycle";
}

export const FOLDERS: FolderDef[] = [
  {
    key: "PUBLIC",
    label: "Public",
    description: "Байгууллагын бүх хэрэглэгч харна.",
    color: "#0f766e",
    icon: Globe,
    kind: "visibility",
  },
  {
    key: "SHARED",
    label: "Shared",
    description: "Зөвхөн уригдсан хүмүүс. Багаар ажиллах.",
    color: "#2563eb",
    icon: Users,
    kind: "visibility",
  },
  {
    key: "PRIVATE",
    label: "Private",
    description: "Зөвхөн эзэмшигч өөрөө харна.",
    color: "#be123c",
    icon: Lock,
    kind: "visibility",
  },
  {
    key: "REFERENCE",
    label: "Reference",
    description: "Бүгд харна, гэхдээ засах боломжгүй. Лавлах материал.",
    color: "#b45309",
    icon: BookMarked,
    kind: "visibility",
  },
  {
    key: "ARCHIVE",
    label: "Archive",
    description: "Дууссан төслүүд. Хадгална, сэргээж болно.",
    color: "#6b7280",
    icon: Archive,
    kind: "lifecycle",
  },
  {
    key: "TRASH",
    label: "Trash",
    description: "Устгасан төслүүд. Сэргээх боломжтой.",
    color: "#44403c",
    icon: Trash2,
    kind: "lifecycle",
  },
];

// Project үүсгэхэд сонгож болох visibility folder-ууд (Archive/Trash орохгүй)
export const VISIBILITY_FOLDERS = FOLDERS.filter((f) => f.kind === "visibility");

export function getFolder(key: FolderKey): FolderDef | undefined {
  return FOLDERS.find((f) => f.key === key);
}

// Project аль folder-т харагдахыг тодорхойлно — төлөв нь visibility-ээс давамгайлна
export function getProjectFolderKey(project: {
  visibility: ProjectVisibility;
  isArchived: boolean;
  trashedAt?: string | null;
}): FolderKey {
  if (project.trashedAt) return "TRASH";
  if (project.isArchived) return "ARCHIVE";
  return project.visibility;
}
