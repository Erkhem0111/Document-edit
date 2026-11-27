import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { effectiveProjectRole, hasRole, visibleProjectsWhere } from "@/lib/permissions";
import type { ProjectRole } from "@/types/domain";
import type { Prisma } from "@prisma/client";

export type ApiUser = {
  id: string;
  email?: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  role?: string;
  // false — админ хараахан зөвшөөрөөгүй шинэ хэрэглэгч (undefined = зөвшөөрөгдсөн)
  isApproved?: boolean;
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

// Барьж аваагүй алдааг хэрэглэгчид ойлгомжтой, зөв HTTP кодоор буцаана.
// Бүгдийг 500 гэж буцаавал клиент "серверт алдаа" гэж харуулж, давхардал,
// устсан зүйл, буруу хүсэлтийг ялгаж чадахгүй.
export function mapApiError(error: unknown): { message: string; status: number } | null {
  if (error instanceof SyntaxError) {
    return { message: "Хүсэлтийн өгөгдөл буруу байна.", status: 400 };
  }
  if (error instanceof TypeError && /form ?data|multipart|body/i.test(error.message)) {
    return { message: "Хүсэлтийн өгөгдөл буруу байна.", status: 400 };
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return null;
  switch (code) {
    case "P2002": // unique constraint
      return { message: "Ийм зүйл аль хэдийн байна.", status: 409 };
    case "P2025": // бичлэг олдсонгүй (зэрэг устгагдсан)
      return { message: "Олдсонгүй. Өөр хүн устгасан байж магадгүй — хуудсаа шинэчилнэ үү.", status: 404 };
    case "P2003": // холбогдох бичлэг устсан
      return { message: "Холбогдох зүйл устсан байна. Хуудсаа шинэчлээд дахин оролдоно уу.", status: 409 };
    case "P2034": // transaction-ий зөрчил / deadlock
      return { message: "Өөр хүн яг одоо өөрчилж байна. Дахин оролдоно уу.", status: 409 };
    case "P1001":
    case "P1002":
    case "P1017":
    case "P2024": // DB холболт / pool дүүрсэн
      return { message: "Өгөгдлийн сан түр завгүй байна. Хэдэн секундын дараа дахин оролдоно уу.", status: 503 };
    default:
      return null;
  }
}

export function withApiError<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const mapped = mapApiError(error);
      if (mapped) {
        if (mapped.status >= 500) console.error("API route error:", error);
        return jsonError(mapped.message, mapped.status);
      }
      console.error("API route error:", error);
      return jsonError("Серверт алдаа гарлаа. Дахин оролдоно уу.", 500);
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
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      isApproved: true,
    },
  });

  if (!dbUser || !dbUser.isActive) {
    return jsonError("Нэвтрэх эрх идэвхгүй байна.", 401);
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    nickname: dbUser.nickname,
    avatarUrl: dbUser.avatarUrl,
    role: dbUser.role,
    isApproved: dbUser.isApproved,
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
  const [project, membership] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { visibility: true, trashedAt: true },
    }),
    getProjectMembership(projectId, user.id),
  ]);

  if (!project) return null;

  // Дүрэм бүгд lib/permissions.ts-д (хогийн савны дүрэм ч мөн)
  const effectiveRole = effectiveProjectRole(project, membership?.role ?? null, user);
  if (!effectiveRole || !hasRole(effectiveRole, minimumRole)) return null;

  // trashed — хогийн саванд байгаа төсөлд шинэ зүйл үүсгэхгүйн тулд дуудагч шалгана
  return { role: effectiveRole, trashed: Boolean(project.trashedAt) };
}

// Өөр хэрэглэгч (жишээ нь даалгаврын хариуцагч) төслийг бодитоор нээж чадах эсэх.
// Түүхий membership биш, эффектив эрхээр шалгана — PRIVATE болсон төслийн
// хуучин гишүүн, хаагдсан хэрэглэгч тэнцэхгүй.
export async function canUserViewProject(projectId: string, userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, isApproved: true },
  });
  if (!target || target.isActive === false) return false;
  return Boolean(await requireProjectRole(projectId, target, "VIEWER"));
}

export function getClientInfo(req: Request) {
  return {
    ipAddress: getClientIp(req.headers),
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
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv")
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

// Хэрэглэгчийн харж болох ИДЭВХТЭЙ (хогийн саванд ороогүй) төслүүдийн нөхцөл
// (хайлт, сүүлийн файлууд, ажлууд, багтаамж). Дүрэм lib/permissions.ts-д.
export function getVisibleProjectWhere(user: ApiUser): Prisma.ProjectWhereInput {
  return visibleProjectsWhere(user, { activeOnly: true });
}
