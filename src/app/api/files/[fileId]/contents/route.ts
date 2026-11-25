import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isEmptyDocJson, isTiptapDoc, liveblocksClient, roomContentForSave } from "@/lib/collab-doc";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

// ~5MB текст — энгийн баримтад хангалттай их
const MAX_CONTENT_CHARS = 5 * 1024 * 1024;

export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    // Хуучин content (том JSON)-ийг татахгүй — эрх, lock шалгахад хэрэгтэй нь л
    select: {
      projectId: true,
      isLocked: true,
      lockedById: true,
      project: { select: { visibility: true } },
    },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "EDITOR");
  if (!membership) return jsonError("Засах эрхгүй.", 403);
  // Компанийн сан: EDITOR шалгалт нь эзэн/админаас бусдыг аль хэдийн хаана
  if (file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN") {
    return jsonError("Файл lock-той байна.", 423);
  }

  // Хэт том JSON-оор DB-г дүүргэхээс сэргийлнэ
  const raw = await req.text();
  if (raw.length > MAX_CONTENT_CHARS) {
    return jsonError("Баримт хэтэрхий том байна.", 413);
  }
  const body = (() => {
    try {
      return JSON.parse(raw || "{}") as { content?: unknown };
    } catch {
      return null;
    }
  })();
  if (!body) return jsonError("Хүсэлтийн өгөгдөл буруу байна.", 400);
  // content өгөгдвөл зөвхөн Tiptap баримт ({ type: "doc", content: [...] }) байна.
  // Өгөхгүй байж болно — tab хаах үеийн жижиг "одоо хадгал" дохио.
  if (body.content !== undefined && !isTiptapDoc(body.content)) {
    return jsonError("Content буруу бүтэцтэй байна.", 400);
  }
  const clientContent = isTiptapDoc(body.content) ? body.content : null;

  // Хамтын засварын өрөө бол үнэн эх сурвалж: бүх хүний засвар нийлсэн баримтыг
  // хадгална. Клиентийн хуулбар хоцорсон (бусдын сүүлийн засвар ирээгүй) байж
  // болох тул түүнийг зөвхөн өрөө байхгүй/уншигдахгүй үед ашиглана.
  let content = clientContent;
  let source: "room" | "client" = "client";
  const lb = liveblocksClient();
  if (lb) {
    try {
      const room = await roomContentForSave(lb, fileId);
      // Өрөө хоосон ч клиент агуулгатай бол — өрөө бөглөгдөөгүй үлдсэн (ховор)
      // тохиолдол; клиентийнхийг хадгална.
      if (room && (!room.empty || !clientContent || isEmptyDocJson(clientContent))) {
        content = room.json;
        source = "room";
      }
    } catch (error) {
      console.warn("Liveblocks room read failed, saving client copy:", error);
    }
  }
  if (!content) {
    return jsonError("Баримтыг одоогоор хадгалж чадсангүй. Дахин оролдоно уу.", 503);
  }

  const updated = await prisma.projectFile.update({
    where: { id: fileId },
    data: { content: content as Prisma.InputJsonValue },
    // Хадгалсан баримтыг буцааж татахгүй — огноо л хэрэгтэй
    select: { updatedAt: true },
  });

  return NextResponse.json({ ok: true, source, updatedAt: updated.updatedAt });
});