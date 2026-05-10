export type FolderType =
  | "public"
  | "shared"
  | "private"
  | "archive"
  | "reference"
  | "trash"
  | "custom";

export interface FileItem {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  owner: string;
  permission: "Owner" | "Editor" | "Viewer";
  type: "doc" | "map" | "report" | "survey" | "image";
}

export interface Folder {
  id: string;
  name: string;
  description: string;
  type: FolderType;
  color: string;
  files: FileItem[];
}
