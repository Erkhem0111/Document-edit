import {
  Users,
  Lock,
  BookMarked,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ProjectVisibility } from "@/types/domain";

// ─── Тогтмол folder-ууд (Миний файлууд / Төслүүд / Компанийн сан / Хогийн сав) ─
// Эдгээр folder DB-д мөр болж хадгалагдахгүй — код дотор тогтмол байна.
// Project бүр аль folder-т хамаарах нь visibility + trashedAt-аар тодорхойлогдоно.
//
// DB-ийн visibility хэвээр (өгөгдөл хөндөхгүй), харагдац нь:
//   PRIVATE   → Миний файлууд
//   SHARED    → Төслүүд (урьсан хүмүүс)
//   PUBLIC    → Төслүүд (ерөнхий хандалт: компанийн бүх хүн харна)
//   REFERENCE → Компанийн сан (бүгд харна, админ засна)
// Archive хасагдсан — DB дэх isArchived талбарыг үл тоомсорлоно.
export type FolderKey = ProjectVisibility | "TRASH";

export interface FolderDef {
  key: FolderKey;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  // visibility — төслийг энд зөөж болно; lifecycle — зөвхөн төлөв (Хогийн сав)
  kind: "visibility" | "lifecycle";
}

export const FOLDERS: FolderDef[] = [
  {
    key: "PRIVATE",
    label: "Миний файлууд",
    description: "Зөвхөн та харна.",
    color: "#be123c",
    icon: Lock,
    kind: "visibility",
  },
  {
    key: "SHARED",
    label: "Төслүүд",
    description: "Багаар ажиллах төслүүд — урьсан хүмүүс эсвэл компанийн бүх хүн.",
    color: "#2563eb",
    icon: Users,
    kind: "visibility",
  },
  {
    key: "REFERENCE",
    label: "Компанийн сан",
    description: "Загвар, журам, лавлах материал. Бүгд харна, админ засна.",
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

// Нэг ажлын орчинтой folder-ууд — дарахад шууд доторх файлууд руу орно
export const DIRECT_WORKSPACE_KEYS: FolderKey[] = ["PRIVATE", "REFERENCE"];
// Төслийг зөөж болох газрууд (⋯ цэс)
export const VISIBILITY_FOLDERS = FOLDERS.filter((f) => f.kind === "visibility");

export function getFolder(key: FolderKey): FolderDef | undefined {
  // Хуучин холбоос (?key=PUBLIC) → Төслүүд
  const k = key === "PUBLIC" ? "SHARED" : key;
  return FOLDERS.find((f) => f.key === k);
}

// Project аль folder-т харагдахыг тодорхойлно — хогийн сав нь давамгайлна
export function getProjectFolderKey(project: {
  visibility: ProjectVisibility;
  trashedAt?: string | null;
}): FolderKey {
  if (project.trashedAt) return "TRASH";
  return project.visibility === "PUBLIC" ? "SHARED" : project.visibility;
}

// Төслийн "ерөнхий хандалт" — компанийн бүх хүн харах эсэх
export function isCompanyWide(project: { visibility: ProjectVisibility }) {
  return project.visibility === "PUBLIC";
}
