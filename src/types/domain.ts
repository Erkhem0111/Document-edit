export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface ApiUserSummary {
  id: string;
  email: string;
  nickname?: string | null;
  avatarUrl?: string | null;
}

export interface ApiFileVersionSummary {
  id: string;
  versionNumber: number;
  fileSize: string;
  checksum: string;
  commitMsg?: string | null;
  createdAt: string;
}

export interface ApiProjectFile {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  folder: string;
  viewerIds: string[];
  editorIds: string[];
  content?: unknown;
  isLocked: boolean;
  lockedById?: string | null;
  lockedAt?: string | null;
  uploaderId: string;
  uploader?: ApiUserSummary;
  lockedBy?: ApiUserSummary | null;
  versions?: ApiFileVersionSummary[];
  openMode?: "browser" | "external" | "download";
  createdAt: string;
  updatedAt: string;
  _count?: {
    comments?: number;
    versions?: number;
  };
}

export interface ApiProject {
  id: string;
  name: string;
  description?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  members?: Array<{ role: ProjectRole; user?: ApiUserSummary }>;
  files?: ApiProjectFile[];
  _count?: {
    files: number;
    tasks: number;
    members: number;
  };
}
