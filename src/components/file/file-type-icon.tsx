import {
  DraftingCompass,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Файлын төрлийн icon ──────────────────────────────────────────────────────
// Өргөтгөл/MIME-ээс төрлийг таниад өнгөт жижиг хавтгай дээр icon харуулна.
// Өнгө нь хэрэглэгчдийн аль хэдийн дассан утгатай (Word — цэнхэр, Excel —
// ногоон, PDF — улаан…) тул нэрийг уншилгүйгээр нүдээр ялгагдана.

type Kind = {
  icon: LucideIcon;
  // тайван, бүдэг дэвсгэр + тод icon
  bg: string;
  fg: string;
  label: string;
};

const KINDS = {
  doc: { icon: FileText, bg: "#e8f0fe", fg: "#1d4ed8", label: "Баримт" },
  word: { icon: FileText, bg: "#e8f0fe", fg: "#1e40af", label: "Word" },
  sheet: { icon: FileSpreadsheet, bg: "#e6f4ea", fg: "#15803d", label: "Хүснэгт" },
  pdf: { icon: FileText, bg: "#fde8e8", fg: "#b91c1c", label: "PDF" },
  image: { icon: FileImage, bg: "#fdf2e3", fg: "#b45309", label: "Зураг" },
  cad: { icon: DraftingCompass, bg: "#f1ebfd", fg: "#6d28d9", label: "Зураг төсөл" },
  slides: { icon: Presentation, bg: "#fdece4", fg: "#c2410c", label: "Илтгэл" },
  archive: { icon: FileArchive, bg: "#eef0f3", fg: "#475569", label: "Архив" },
  text: { icon: FileText, bg: "#eef0f3", fg: "#475569", label: "Текст" },
  other: { icon: FileIcon, bg: "#eef0f3", fg: "#64748b", label: "Файл" },
} satisfies Record<string, Kind>;

export type FileKind = keyof typeof KINDS;

export function getFileKind(name: string, mimeType = ""): FileKind {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  // Сайт дотор үүсгэсэн баримт (өргөтгөлгүй, text/html)
  if (mimeType === "text/html" && !ext) return "doc";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "sheet";
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (["dwg", "dxf", "dgn", "ifc", "rvt", "shp", "kml", "kmz"].includes(ext)) return "cad";
  if (["ppt", "pptx", "odp"].includes(ext)) return "slides";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "tif", "tiff", "bmp", "heic"].includes(ext)) {
    return "image";
  }
  if (["txt", "md", "log"].includes(ext) || mimeType.startsWith("text/")) return "text";
  if (!ext) return "doc";
  return "other";
}

export function getFileKindLabel(name: string, mimeType = "") {
  return KINDS[getFileKind(name, mimeType)].label;
}

export function FileTypeIcon({
  name,
  mimeType,
  size = "md",
  className,
}: {
  name: string;
  mimeType?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const kind = KINDS[getFileKind(name, mimeType)];
  const Icon = kind.icon;
  return (
    <span
      aria-hidden
      title={kind.label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        size === "sm" ? "h-5 w-5" : "h-7 w-7",
        className,
      )}
      style={{ backgroundColor: kind.bg, color: kind.fg }}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} strokeWidth={2.2} />
    </span>
  );
}
