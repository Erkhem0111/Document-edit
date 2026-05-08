import { getClientInfo, jsonError, requireProjectRole, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

type Params = Promise<{ fileId: string }>;

export async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "OWNER");
  if (!membership) return jsonError("Зөвхөн admin/owner файл lock хийж чадна.", 403);

  if (file.isLocked && file.lockedById !== user.id) {
    return jsonError("Файл аль хэдийн өөр хэрэглэгч дээр lock-той байна.", 423);
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const locked = await tx.projectFile.update({
      where: { id: fileId },
      data: {
        isLocked: true,
        lockedById: user.id,
        lockedAt: new Date(),
      },
      include: {
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

  return NextResponse.json({ file: updated });
}

export async function DELETE(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { fileId } = await context.params;
  const file = await prisma.projectFile.findUnique({ where: { id: fileId } });
  if (!file) return jsonError("Файл олдсонгүй.", 404);

  const membership = await requireProjectRole(file.projectId, user, "OWNER");
  const lockedByMe = file.lockedById === user.id;
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
}
