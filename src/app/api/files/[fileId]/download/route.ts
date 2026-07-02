import {
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, getPresignedDownloadUrl } from "@/lib/r2";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

// GET /api/files/[fileId]/download[?version=N]
// Файлыг public URL биш, 1 цагийн хугацаатай presigned URL руу redirect хийнэ.
export const GET = withApiError(async function GET(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const url = new URL(req.url);
  const requested = url.searchParams.get("version");
  const inline = url.searchParams.get("inline") === "true";

  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      name: true,
      projectId: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
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
  const found = file.versions.some((v) => v.versionNumber === versionNumber);
  if (!found) return jsonError("Тухайн хувилбар олдсонгүй.", 404);

  const objectKey = buildObjectKey(file.projectId, file.id, versionNumber);
  const signedUrl = await getPresignedDownloadUrl(objectKey, {
    fileName: file.name,
    inline,
  });

  // Татсан үйлдлийг бүртгэнэ
  await prisma.fileActivity.create({
    data: { fileId: file.id, userId: user.id, action: "DOWNLOAD", ...getClientInfo(req) },
  });

  return NextResponse.redirect(signedUrl);
});
