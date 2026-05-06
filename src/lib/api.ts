import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { ProjectRole } from "@prisma/client";

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

export async function requireUser(): Promise<ApiUser | NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonError("Нэвтэрсэн байх шаардлагатай.", 401);
  }

  return {
    id: session.user.id,
    role: session.user.role,
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

  if (!membership || ROLE_POWER[membership.role] < ROLE_POWER[minimumRole]) {
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
