import {
  withApiError,
  canAccessFile,
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
} from "@/lib/api";
import { minioClient } from "@/lib/minio";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ fileId: string }>;

const bucketName = process.env.MINIO_BUCKET || "company-files";

export const GET = withApiError(async function GET(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Файл татах эрхгүй.", 403);

  if (!canAccessFile(file, user)) return jsonError("Ene file harah erhgui.", 403);

  const latestVersion = file.versions[0];
  if (!latestVersion) return jsonError("Файлын version олдсонгүй.", 404);

  await prisma.fileActivity.create({
    data: {
      fileId,
      userId: user.id,
      action: "DOWNLOAD",
      ...getClientInfo(req),
    },
  });

  if (latestVersion.fileData) {
    const data = Buffer.from(latestVersion.fileData);
    const safeName = file.name.replace(/["\r\n]/g, "_");

    return new Response(data, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": data.byteLength.toString(),
      },
    });
  }

  const url = await minioClient.presignedGetObject(
    bucketName,
    latestVersion.fileUrl,
    60 * 5,
  );

  return NextResponse.json({ url });
});
