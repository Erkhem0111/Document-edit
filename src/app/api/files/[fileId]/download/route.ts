import {
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/r2";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function getInlineSafeType(mimeType: string, fileName: string) {
  if (INLINE_SAFE_TYPES.has(mimeType)) return mimeType;
  if (fileName.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return null;
}

// GET /api/files/[fileId]/download[?version=N]
// Файлыг public URL биш, 1 цагийн хугацаатай presigned URL руу redirect хийнэ.
export const GET = withApiError(async function GET(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const url = new URL(req.url);
  const requested = url.searchParams.get("version");
  const wantsInline = url.searchParams.get("inline") === "true";

  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      name: true,
      mimeType: true,
      projectId: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true, objectKey: true },
      },
    },
  });

  if (!file) return jsonError("Файл олдсонгүй.", 404);

  // Файл нь project-ийн хандалтыг өвлөнө
  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Татах эрхгүй.", 403);

  if (file.versions.length === 0) {
    return jsonError("Татах файл (хувилбар) байхгүй байна.", 404);
  }

  const versionNumber = requested
    ? Number(requested)
    : file.versions[0].versionNumber;
  const found = file.versions.find((v) => v.versionNumber === versionNumber);
  if (!found) return jsonError("Тухайн хувилбар олдсонгүй.", 404);

  // Browser дотор зөвхөн script ажиллуулах боломжгүй төрлийг нээнэ.
  // HTML/SVG г.м. бусад нь үргэлж татагдана (stored XSS-ээс сэргийлнэ).
  const inlineType = wantsInline ? getInlineSafeType(file.mimeType, file.name) : null;

  // R2 key-г DB-ээс авна — v2+ хувилбарын key нь давтагдашгүй suffix-тэй
  const signedUrl = await getPresignedDownloadUrl(found.objectKey, {
    fileName: file.name,
    inline: Boolean(inlineType),
    contentType: inlineType ?? undefined,
  });

  // Үйлдлийг бүртгэнэ — урьдчилан харах (inline) нь татах биш, үзэх
  await prisma.fileActivity.create({
    data: {
      fileId: file.id,
      userId: user.id,
      action: wantsInline ? "VIEW" : "DOWNLOAD",
      ...getClientInfo(req),
    },
  });

  return NextResponse.redirect(signedUrl);
});
