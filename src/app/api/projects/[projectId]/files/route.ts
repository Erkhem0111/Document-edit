import {
  getClientInfo,
  isEditableInBrowser,
  isExternalEngineeringFile,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
} from "@/lib/api";
import { minioClient } from "@/lib/minio";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

const bucketName = process.env.MINIO_BUCKET || "company-files";

function getOpenMode(mimeType: string, name: string) {
  if (isExternalEngineeringFile(mimeType, name)) return "external";
  if (isEditableInBrowser(mimeType, name)) return "browser";
  return "download";
}

async function ensureBucket() {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, "us-east-1");
  }
}

export async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "VIEWER");
  if (!membership) return jsonError("Файл харах эрхгүй.", 403);

  const files = await prisma.projectFile.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      uploader: { select: { id: true, email: true, nickname: true } },
      lockedBy: { select: { id: true, email: true, nickname: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
      _count: {
        select: { comments: true, versions: true },
      },
    },
  });

  const shaped = files.map((file) => ({
    ...file,
    openMode: getOpenMode(file.mimeType, file.name),
  }));

  return NextResponse.json({ files: serializeJson(shaped) });
}

export async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Файл upload хийх эрхгүй.", 403);

  const formData = await req.formData();
  const upload = formData.get("file");
  const commitMsg = formData.get("commitMsg");

  if (!(upload instanceof File)) {
    return jsonError("Upload хийх файл шаардлагатай.", 400);
  }

  await ensureBucket();

  const bytes = Buffer.from(await upload.arrayBuffer());
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const objectName = `${projectId}/${crypto.randomUUID()}-${upload.name}`;

  await minioClient.putObject(bucketName, objectName, bytes, bytes.length, {
    "Content-Type": upload.type || "application/octet-stream",
  });

  const clientInfo = getClientInfo(req);
  const file = await prisma.$transaction(async (tx) => {
    const createdFile = await tx.projectFile.create({
      data: {
        projectId,
        name: upload.name,
        mimeType: upload.type || "application/octet-stream",
        uploaderId: user.id,
      },
    });

    await tx.fileVersion.create({
      data: {
        fileId: createdFile.id,
        uploadedById: user.id,
        versionNumber: 1,
        fileUrl: objectName,
        fileSize: BigInt(bytes.length),
        checksum,
        commitMsg:
          typeof commitMsg === "string" && commitMsg.trim()
            ? commitMsg.trim()
            : null,
      },
    });

    await tx.fileActivity.create({
      data: {
        fileId: createdFile.id,
        userId: user.id,
        action: "UPLOAD",
        ...clientInfo,
      },
    });

    return tx.projectFile.findUniqueOrThrow({
      where: { id: createdFile.id },
      include: {
        uploader: { select: { id: true, email: true, nickname: true } },
        lockedBy: { select: { id: true, email: true, nickname: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
        _count: {
          select: { comments: true, versions: true },
        },
      },
    });
  });

  return NextResponse.json(
    {
      file: serializeJson({
        ...file,
        openMode: getOpenMode(file.mimeType, file.name),
      }),
    },
    { status: 201 },
  );
}
