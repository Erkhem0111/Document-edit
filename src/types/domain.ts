export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";
export type ProjectVisibility = "PUBLIC" | "SHARED" | "PRIVATE" | "REFERENCE";
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
  uploadedBy?: ApiUserSummary;
}

export interface ApiTask {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  assignee?: ApiUserSummary;
  creator?: ApiUserSummary;
}

export interface ApiFileActivity {
  id: string;
  action: "VIEW" | "DOWNLOAD" | "UPLOAD" | "LOCK" | "UNLOCK" | "DELETE_VERSION";
  createdAt: string;
  user?: ApiUserSummary;
}

export interface ApiFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface ApiProjectFile {
  id: string;
  projectId: string;
  folderId?: string | null;
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
  activities?: ApiFileActivity[];
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
  visibility: ProjectVisibility;
  isArchived: boolean;
  trashedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: Array<{ role: ProjectRole; user?: ApiUserSummary }>;
  files?: ApiProjectFile[];
  folders?: ApiFolder[];
  _count?: {
    files: number;
    tasks: number;
    members: number;
  };
}
