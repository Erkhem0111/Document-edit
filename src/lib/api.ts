import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { FileFolder, ProjectRole } from "@/types/domain";

export type ApiUser = {
  id: string;
  role?: string;
};

export type FileAccessRecord = {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  isLocked: boolean;
  lockedById: string | null;
  uploaderId: string;
  viewerIds: string[];
  editorIds: string[];
};

export type FileVersionWithData = {
  id: string;
  versionNumber: number;
  fileUrl: string;
  fileData: Uint8Array | Buffer | null;
  fileSize: bigint;
  checksum: string;
  commitMsg: string | null;
  createdAt: Date;
};

const ROLE_POWER: Record<ProjectRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function requireUser(): Promise<ApiUser | NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonError("Нэвтэрсэн байх шаардлагатай.", 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return jsonError("Нэвтрэх эрх идэвхгүй байна.", 401);
  }

  return {
    id: dbUser.id,
    role: dbUser.role,
  };
}

export function serializeJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

export async function getProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });
}

export async function requireProjectRole(
  projectId: string,
  user: ApiUser,
  minimumRole: ProjectRole,
) {
  if (user.role === "ADMIN") {
    return { role: "OWNER" as ProjectRole };
  }

  const membership = await getProjectMembership(projectId, user.id);

  if (
    !membership ||
    ROLE_POWER[membership.role as ProjectRole] < ROLE_POWER[minimumRole]
  ) {
    return null;
  }

  return membership;
}

export function getClientInfo(req: Request) {
  return {
    ipAddress:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  };
}

export function isEditableInBrowser(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx")
  );
}

export function isExternalEngineeringFile(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  return (
    mimeType.includes("dwg") ||
    lowerName.endsWith(".dwg") ||
    lowerName.endsWith(".dxf") ||
    lowerName.endsWith(".rvt") ||
    lowerName.endsWith(".ifc")
  );
}

export function getFileFolder(fileName: string): FileFolder {
  const lowerName = fileName.toLowerCase();
  if (/\.(docx?|pdf|txt)$/.test(lowerName)) return "documents";
  if (/\.(xlsx?|csv)$/.test(lowerName)) return "spreadsheets";
  if (/\.(dwg|dxf|ifc|rvt)$/.test(lowerName)) return "engineering";
  return "other";
}

export function canAccessFile(
  file: { uploaderId: string; viewerIds?: string[] | null; editorIds?: string[] | null },
  user: ApiUser,
) {
  const viewerIds = file.viewerIds ?? [];
  const editorIds = file.editorIds ?? [];
  return (
    user.role === "ADMIN" ||
    file.uploaderId === user.id ||
    viewerIds.includes(user.id) ||
    editorIds.includes(user.id)
  );
}

export function canEditFile(
  file: { uploaderId: string; editorIds?: string[] | null },
  user: ApiUser,
) {
  const editorIds = file.editorIds ?? [];
  return user.role === "ADMIN" || file.uploaderId === user.id || editorIds.includes(user.id);
}

export async function getFileAccessRecord(
  fileId: string,
): Promise<FileAccessRecord | null> {
  const rows = await prisma.$queryRaw<FileAccessRecord[]>`
    SELECT
      id,
      "projectId",
      name,
      "mimeType",
      "isLocked",
      "lockedById",
      "uploaderId",
      "viewerIds",
      "editorIds"
    FROM "ProjectFile"
    WHERE id = ${fileId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getAccessibleProjectFileIds(
  projectId: string,
  user: ApiUser,
): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "ProjectFile"
    WHERE "projectId" = ${projectId}
      AND (
        "uploaderId" = ${user.id}
        OR "viewerIds" @> ARRAY[${user.id}]::TEXT[]
        OR "editorIds" @> ARRAY[${user.id}]::TEXT[]
      )
  `;

  return rows.map((row) => row.id);
}

export async function updateProjectFileContent(
  fileId: string,
  content: unknown,
) {
  await prisma.$executeRaw`
    UPDATE "ProjectFile"
    SET "content" = ${JSON.stringify(content)}::jsonb,
        "updatedAt" = NOW()
    WHERE id = ${fileId}
  `;
}

export async function updateProjectFileAccessFields({
  fileId,
  folder,
  viewerIds,
  editorIds,
}: {
  fileId: string;
  folder: string;
  viewerIds: string[];
  editorIds: string[];
}) {
  await prisma.$executeRaw`
    UPDATE "ProjectFile"
    SET "folder" = ${folder},
        "viewerIds" = ${viewerIds},
        "editorIds" = ${editorIds}
    WHERE id = ${fileId}
  `;
}

export async function updateFileVersionData(
  versionId: string,
  fileData: Buffer,
) {
  await prisma.$executeRaw`
    UPDATE "FileVersion"
    SET "fileData" = ${fileData}
    WHERE id = ${versionId}
  `;
}

export async function getLatestFileVersionWithData(
  fileId: string,
): Promise<FileVersionWithData | null> {
  const rows = await prisma.$queryRaw<FileVersionWithData[]>`
    SELECT
      id,
      "versionNumber",
      "fileUrl",
      "fileData",
      "fileSize",
      checksum,
      "commitMsg",
      "createdAt"
    FROM "FileVersion"
    WHERE "fileId" = ${fileId}
    ORDER BY "versionNumber" DESC
    LIMIT 1
  `;

  return rows[0] ?? null;
}
