import {
  Globe,
  Users,
  Lock,
  BookMarked,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ProjectVisibility } from "@/types/domain";

// ─── Тогтмол folder-ууд (4 хандалтын төрөл + Хогийн сав) ──────────────────────
// Эдгээр folder DB-д мөр болж хадгалагдахгүй — код дотор тогтмол байна.
// Хэн ч нэвтэрхэд үргэлж бэлэн, өнгө + icon-оор ялгарч харагдана.
// Project бүр аль folder-т хамаарах нь visibility + trashedAt-аар тодорхойлогдоно.

// Archive хасагдсан — Trash-тай ижил үүрэгтэй байсан. DB дэх isArchived
// талбарыг одоо үл тоомсорлоно (хуучин архивласан төсөл энгийн төсөл шиг).
export type FolderKey = ProjectVisibility | "TRASH";

export interface FolderDef {
  key: FolderKey;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  // visibility — project үүсгэхэд сонгож болно
  // lifecycle  — зөвхөн төлөв (Хогийн сав руу зөөгдөнө)
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
    key: "TRASH",
    label: "Хогийн сав",
    description: "Устгасан зүйлс. Сэргээх эсвэл бүр мөсөн устгах боломжтой.",
    color: "#8a817c",
    icon: Trash2,
    kind: "lifecycle",
  },
];

// Project үүсгэхэд сонгож болох visibility folder-ууд (Trash орохгүй)

// Нэг хүнд ганц л ажлын орчин (төсөл) байдаг folder-ууд — дарахад шууд
// тэр орчны доторх файлууд руу орно ("нээх → дахин нээх" шат байхгүй).
export const DIRECT_WORKSPACE_KEYS: FolderKey[] = ["PRIVATE", "PUBLIC", "REFERENCE"];
export const VISIBILITY_FOLDERS = FOLDERS.filter((f) => f.kind === "visibility");

export function getFolder(key: FolderKey): FolderDef | undefined {
  return FOLDERS.find((f) => f.key === key);
}

// Project аль folder-т харагдахыг тодорхойлно — төлөв нь visibility-ээс давамгайлна
export function getProjectFolderKey(project: {
  visibility: ProjectVisibility;
  trashedAt?: string | null;
}): FolderKey {
  if (project.trashedAt) return "TRASH";
  return project.visibility;
}
