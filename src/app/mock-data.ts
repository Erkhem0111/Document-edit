import type { FileItem, Folder } from "@/types/domain";


export const FOLDER_COLORS = [
  { name: "Teal", value: "oklch(0.45 0.07 210)" },
  { name: "Gold", value: "oklch(0.82 0.075 90)" },
  { name: "Mauve", value: "oklch(0.45 0.06 330)" }, 
  { name: "Sage", value: "oklch(0.62 0.06 150)" },
  { name: "Clay", value: "oklch(0.62 0.1 50)" },
  { name: "Slate", value: "oklch(0.5 0.02 240)" },
];

export const TEAM_USERS = [
  { id: "u1", name: "Adem Yıldız", email: "adem@terraline.co" },
  { id: "u2", name: "Selin Korkmaz", email: "selin@terraline.co" },
  { id: "u3", name: "Mehmet Arslan", email: "mehmet@terraline.co" },
  { id: "u4", name: "Elif Demir", email: "elif@terraline.co" },
  { id: "u5", name: "Kaan Öztürk", email: "kaan@terraline.co" },
  { id: "u6", name: "Zeynep Aksoy", email: "zeynep@terraline.co" },
];

const f = (
  id: string,
  name: string,
  size: string,
  days: number,
  owner: string,
  type: FileItem["type"],
): FileItem => ({
  id,
  name,
  size,
  uploadedAt: new Date(Date.now() - days * 86400000).toISOString(),
  owner,
  permission: "Editor",
  type,
});

export const DEFAULT_FOLDERS: Folder[] = [
  {
    id: "public",
    name: "Public Folder",
    description: "Visible to everyone in the company.",
    type: "public",
    color: "oklch(0.45 0.07 210)",
    files: [
      f("p1", "Company Survey Standards.pdf", "2.4 MB", 1, "Adem Y.", "doc"),
      f("p2", "Topographic Base Map - Region A.dwg", "18.2 MB", 3, "Selin K.", "map"),
      f("p3", "GNSS Calibration Guide.pdf", "1.1 MB", 7, "Mehmet A.", "doc"),
    ],
  },
  {
    id: "shared",
    name: "Shared / Invited",
    description: "Only invited collaborators can view.",
    type: "shared",
    color: "oklch(0.82 0.075 90)",
    files: [
      f("s1", "Highway-12 Cadastral Plan.pdf", "5.6 MB", 0, "Elif D.", "map"),
      f("s2", "Boundary Survey - Lot 47.docx", "820 KB", 2, "Kaan Ö.", "doc"),
    ],
  },
  {
    id: "private",
    name: "Private Folder",
    description: "Only you can access these files.",
    type: "private",
    color: "oklch(0.45 0.06 330)",
    files: [
      f("pr1", "My Field Notes - Nov.md", "42 KB", 0, "You", "doc"),
      f("pr2", "Personal Coordinate Log.xlsx", "210 KB", 5, "You", "report"),
    ],
  },
  {
    id: "archive",
    name: "Archive",
    description: "Completed projects, kept for reference.",
    type: "archive",
    color: "oklch(0.5 0.02 240)",
    files: [
      f("a1", "Project Aksu 2023 - Final Report.pdf", "12.8 MB", 120, "Zeynep A.", "report"),
      f("a2", "Marina Survey 2022.zip", "44 MB", 320, "Adem Y.", "survey"),
    ],
  },
  {
    id: "reference",
    name: "Reference Library",
    description: "View-only resources & manuals.",
    type: "reference",
    color: "oklch(0.62 0.06 150)",
    files: [
      f("r1", "TS-EN ISO 17123 Standards.pdf", "3.2 MB", 60, "Library", "doc"),
      f("r2", "Datum Transformation Guide.pdf", "1.8 MB", 90, "Library", "doc"),
    ],
  },
  {
    id: "trash",
    name: "Trash",
    description: "Deleted files, recoverable for 30 days.",
    type: "trash",
    color: "oklch(0.55 0.1 30)",
    files: [f("t1", "Old draft - Survey Plot v1.dwg", "2.1 MB", 4, "You", "map")],
  },
];
