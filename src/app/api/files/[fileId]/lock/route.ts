import { getClientInfo, jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: { projectId: true, isLocked: true, lockedById: true },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "OWNER");
  if (!membership) return jsonError("Зөвхөн admin/owner файл lock хийж чадна.", 403);

  if (file.isLocked && file.lockedById !== user.id) {
    return jsonError("Файл аль хэдийн өөр хэрэглэгч дээр lock-той байна.", 423);
  }

  // Шалгах + түгжих нэг атомик алхам: хоёр хүн зэрэг дарвал зөвхөн нэг нь түгжинэ
  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const { count } = await tx.projectFile.updateMany({
      where: { id: fileId, OR: [{ isLocked: false }, { lockedById: user.id }] },
      data: {
        isLocked: true,
        lockedById: user.id,
        lockedAt: new Date(),
      },
    });
    if (count === 0) return null;

    const locked = await tx.projectFile.findUniqueOrThrow({
      where: { id: fileId },
      select: {
        id: true,
        isLocked: true,
        lockedAt: true,
        lockedBy: { select: { id: true, email: true, nickname: true } },
      },
    });

    await tx.fileActivity.create({
      data: {
        fileId,
        userId: user.id,
        action: "LOCK",
        ...getClientInfo(req),
      },
    });

    return locked;
  });
  if (!updated) return jsonError("Файл аль хэдийн өөр хэрэглэгч дээр lock-той байна.", 423);

  return NextResponse.json({ file: updated });
});

export const DELETE = withApiError(async function DELETE(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    select: { projectId: true, isLocked: true, lockedById: true },
  });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "OWNER");
  // Түгжсэн хүн өөрөө тайлж болно — гэхдээ төсөлдөө хандах эрхтэй хэвээр байх ёстой
  const lockedByMe =
    file.lockedById === user.id && Boolean(await requireProjectRole(file.projectId, user, "VIEWER"));
  if (!membership && !lockedByMe) {
    return jsonError("Файл unlock хийх эрхгүй.", 403);
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const unlocked = await tx.projectFile.update({
      where: { id: fileId },
      data: {
        isLocked: false,
        lockedById: null,
        lockedAt: null,
      },
      select: { id: true, isLocked: true, lockedAt: true },
    });

    await tx.fileActivity.create({
      data: {
        fileId,
        userId: user.id,
        action: "UNLOCK",
        ...getClientInfo(req),
      },
    });

    return unlocked;
  });

  return NextResponse.json({ file: updated });
});
