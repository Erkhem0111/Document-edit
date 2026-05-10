export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type FileFolder = "documents" | "spreadsheets" | "engineering" | "other";
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
