import {
  withApiError,
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  buildObjectKey,
  computeChecksum,
  getPublicUrl,
  uploadToR2,
} from "@/lib/r2";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { visibility: true } } },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!membership) return jsonError("Version харах эрхгүй.", 403);

  const versions = await prisma.fileVersion.findMany({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      fileSize: true,
      checksum: true,
      commitMsg: true,
      createdAt: true,
      uploadedBy: { select: { id: true, email: true, nickname: true } },
    },
  });

  return NextResponse.json({ versions: serializeJson(versions) });
});

export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { visibility: true } } },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "EDITOR");
  if (!membership) return jsonError("Version upload хийх эрхгүй.", 403);
  if (file.project.visibility === "REFERENCE") {
    return jsonError("Reference folder read-only тул version upload хийх боломжгүй.", 403);
  }
  if (file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("Файл өөр хэрэглэгч дээр lock-той байна.", 423);
  }

  const formData = await req.formData();
  const upload = formData.get("file");
  const commitMsg = formData.get("commitMsg");
  if (!(upload instanceof File)) return jsonError("Upload хийх файл шаардлагатай.", 400);

  const bytes = Buffer.from(await upload.arrayBuffer());
  const checksum = computeChecksum(bytes);

  // Дараагийн version дугаарыг тооцоод R2-д upload хийнэ
  const latest = await prisma.fileVersion.findFirst({
    where: { fileId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const objectKey = buildObjectKey(file.projectId, fileId, versionNumber);

  try {
    await uploadToR2({
      buffer: bytes,
      objectKey,
      mimeType: upload.type || "application/octet-stream",
    });
  } catch (err) {
    console.error("R2 upload failed:", err);
    return jsonError(
      "Файлыг cloud storage (R2)-д хадгалж чадсангүй. R2 API token-ы эрх болон bucket тохиргоог шалгана уу.",
      502,
    );
  }

  const fileUrl = getPublicUrl(objectKey);

  const version = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.fileVersion.create({
      data: {
        fileId,
        uploadedById: user.id,
        versionNumber,
        fileUrl, // ← R2 public URL
        fileSize: BigInt(bytes.length),
        checksum,
        commitMsg:
          typeof commitMsg === "string" && commitMsg.trim()
            ? commitMsg.trim()
            : null,
      },
      select: {
        id: true,
        versionNumber: true,
        fileSize: true,
        checksum: true,
        commitMsg: true,
        createdAt: true,
        uploadedBy: { select: { id: true, email: true, nickname: true } },
      },
    });

    await tx.projectFile.update({
      where: { id: fileId },
      data: {
        name: upload.name || file.name,
        mimeType: upload.type || file.mimeType,
      },
    });

    await tx.fileActivity.create({
      data: {
        fileId,
        userId: user.id,
        action: "UPLOAD",
        ...getClientInfo(req),
      },
    });

    return created;
  });

  return NextResponse.json({ version: serializeJson(version) }, { status: 201 });
});
