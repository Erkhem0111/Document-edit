import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ProjectRole } from "@/types/domain";

export type ApiUser = {
  id: string;
  role?: string;
};

const ROLE_POWER: Record<ProjectRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export function withApiError<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("API route error:", error);
      return jsonError("Internal server error.", 500);
    }
  };
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

export function getFileFolder(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (/\.(docx?|pdf|txt)$/.test(lowerName)) return "documents";
  if (/\.(xlsx?|csv)$/.test(lowerName)) return "spreadsheets";
  if (/\.(dwg|dxf|ifc|rvt)$/.test(lowerName)) return "engineering";
  return "other";
}

export function canAccessFile(
  file: { uploaderId: string; viewerIds: string[]; editorIds: string[] },
  user: ApiUser,
) {
  return (
    user.role === "ADMIN" ||
    file.uploaderId === user.id ||
    file.viewerIds.includes(user.id) ||
    file.editorIds.includes(user.id)
  );
}

export function canEditFile(
  file: { uploaderId: string; editorIds: string[] },
  user: ApiUser,
) {
  return user.role === "ADMIN" || file.uploaderId === user.id || file.editorIds.includes(user.id);
}
