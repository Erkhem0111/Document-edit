import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  getClientInfo,
  getFileFolder,
  jsonError,
  requireProjectRole,
  requireUser,
  serializeJson,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { canCreateEditableContent, getEditableUploadContent } from "@/lib/editable-upload";
import {
  computeChecksum,
  deleteFromR2,
  downloadFromR2,
  getPresignedUploadUrl,
  getPublicUrl,
  headR2Object,
} from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/upload";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ projectId: string }>;

// ─── POST /api/projects/[projectId]/files/direct ─────────────────────────────
// Том файлыг server-ээр дамжуулахгүй (Vercel 4.5MB хязгаар) — хоёр алхамтай:
//  1) { action: "start", name, size, type } → R2 руу шууд PUT хийх холбоос + token
//  2) browser файлаа R2 руу илгээнэ
//  3) { action: "complete", key, token, name, type, folderId } → R2 дээр байгааг
//     шалгаж, файлыг төсөлд бүртгэнэ
// token нь key-г тухайн хэрэглэгч, төсөлд холбоно — өөр хүний/төслийн объектыг
// "миний файл" гэж бүртгүүлэх боломжгүй.

const TOKEN_TTL_MS = 60 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(payload).digest("hex");
}

function makeToken(userId: string, projectId: string, key: string) {
  const expires = Date.now() + TOKEN_TTL_MS;
  return `${expires}.${sign(`${userId}:${projectId}:${key}:${expires}`)}`;
}

function verifyToken(token: string, userId: string, projectId: string, key: string) {
  const [expiresRaw, mac] = token.split(".");
  const expires = Number(expiresRaw);
  if (!expires || !mac || expires < Date.now()) return false;
  const expected = Buffer.from(sign(`${userId}:${projectId}:${key}:${expires}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 255) : "";
}

export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "EDITOR");
  if (!membership) return jsonError("Файл upload хийх эрхгүй.", 403);
  if (membership.trashed) {
    return jsonError("Хогийн саванд байгаа төсөлд нэмэх боломжгүй. Эхлээд сэргээнэ үү.", 400);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = cleanName(body?.name);
  const mimeType =
    typeof body?.type === "string" && body.type ? body.type.slice(0, 200) : "application/octet-stream";
  if (!name) return jsonError("Файлын нэр шаардлагатай.", 400);

  if (body?.action === "start") {
    const size = Number(body.size);
    if (!Number.isFinite(size) || size <= 0) return jsonError("Файлын хэмжээ буруу байна.", 400);
    if (size > MAX_UPLOAD_BYTES) return jsonError("Файл хэтэрхий том байна (дээд тал нь 50MB).", 413);
    // Түлхүүр нь projects/<projectId>/... хэлбэртэй — файл зөөх үед замыг нь солино
    const key = `projects/${projectId}/${randomUUID()}/v1`;
    const uploadUrl = await getPresignedUploadUrl(key, mimeType);
    return NextResponse.json({ uploadUrl, key, token: makeToken(user.id, projectId, key) });
  }

  if (body?.action !== "complete") return jsonError("Буруу хүсэлт.", 400);

  const key = typeof body.key === "string" ? body.key : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (!key.startsWith(`projects/${projectId}/`) || !verifyToken(token, user.id, projectId, key)) {
    return jsonError("Upload-ийн хугацаа дууссан эсвэл буруу байна. Дахин оролдоно уу.", 400);
  }

  const object = await headR2Object(key);
  if (!object) return jsonError("Файл cloud storage-д хүрээгүй байна. Дахин оролдоно уу.", 400);
  if (object.size > MAX_UPLOAD_BYTES) {
    await deleteFromR2(key).catch(() => null);
    return jsonError("Файл хэтэрхий том байна (дээд тал нь 50MB).", 413);
  }
  // Нэг түлхүүрийг хоёр удаа бүртгэхгүй
  const existing = await prisma.fileVersion.findUnique({ where: { objectKey: key }, select: { id: true } });
  if (existing) return jsonError("Энэ файл аль хэдийн бүртгэгдсэн.", 409);

  // folderId нь энэ төсөлд харьяалагдах ёстой
  let folderId: string | null = null;
  if (typeof body.folderId === "string" && body.folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: body.folderId },
      select: { projectId: true },
    });
    if (folder?.projectId === projectId) folderId = body.folderId;
  }

  // Текст файлыг browser дотор засварлах боломжтой болгоно (жижиг upload-тай адил)
  let content: Prisma.InputJsonValue | undefined;
  let checksum = `etag:${object.etag}`;
  if (canCreateEditableContent(name, mimeType)) {
    const bytes = await downloadFromR2(key);
    checksum = computeChecksum(bytes);
    const editable = await getEditableUploadContent({ buffer: bytes, fileName: name, mimeType });
    if (editable) content = editable as Prisma.InputJsonValue;
  }

  const file = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.projectFile.create({
      data: {
        projectId,
        folderId,
        name,
        mimeType,
        folder: getFileFolder(name),
        editorIds: [user.id],
        uploaderId: user.id,
        content,
      },
      select: { id: true, projectId: true, name: true },
    });
    await tx.fileVersion.create({
      data: {
        fileId: created.id,
        uploadedById: user.id,
        versionNumber: 1,
        objectKey: key,
        fileUrl: getPublicUrl(key),
        fileSize: BigInt(object.size),
        checksum,
      },
    });
    await tx.fileActivity.create({
      data: { fileId: created.id, userId: user.id, action: "UPLOAD", ...getClientInfo(req) },
    });
    return created;
  });

  return NextResponse.json({ file: serializeJson(file) }, { status: 201 });
});
