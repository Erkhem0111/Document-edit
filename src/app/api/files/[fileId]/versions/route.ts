import {
  canEditFile,
  getFileAccessRecord,
  getClientInfo,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
  updateFileVersionData,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

export async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await getFileAccessRecord(fileId);
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
}

export async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await getFileAccessRecord(fileId);
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "EDITOR");
  if (!membership) return jsonError("Version upload хийх эрхгүй.", 403);
  if (!canEditFile(file, user)) return jsonError("Ene file zasah erhgui.", 403);
  if (file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("Файл өөр хэрэглэгч дээр lock-той байна.", 423);
  }

  const formData = await req.formData();
  const upload = formData.get("file");
  const commitMsg = formData.get("commitMsg");
  if (!(upload instanceof File)) return jsonError("Upload хийх файл шаардлагатай.", 400);

  const bytes = Buffer.from(await upload.arrayBuffer());
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");

  const version = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const latest = await tx.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const created = await tx.fileVersion.create({
      data: {
        fileId,
        uploadedById: user.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        fileUrl: `db:${checksum}`,
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

  await updateFileVersionData(version.id, bytes);

  return NextResponse.json({ version: serializeJson(version) }, { status: 201 });
}
