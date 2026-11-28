import { jsonError, requireUser, serializeJson, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

// GET /api/notifications — хонхны жагсаалт (сүүлийн 30) ба уншаагүй тоо.
// unreadTasks — "Даалгавар" цэсний тоо; unreadFiles — файл бүрийн уншаагүй сэтгэгдэл.
export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const [items, unread, unreadTasks, fileGroups] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        url: true,
        fileId: true,
        readAt: true,
        createdAt: true,
        actor: { select: { nickname: true, email: true } },
      },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null, type: { in: ["TASK_ASSIGNED", "TASK_DONE"] } },
    }),
    prisma.notification.groupBy({
      by: ["fileId"],
      where: { userId: user.id, readAt: null, fileId: { not: null }, type: { in: ["COMMENT", "COMMENT_REPLY"] } },
      _count: { _all: true },
    }),
  ]);

  const unreadFiles: Record<string, number> = {};
  for (const g of fileGroups) if (g.fileId) unreadFiles[g.fileId] = g._count._all;

  return NextResponse.json({
    notifications: serializeJson(items),
    unread,
    unreadTasks,
    unreadFiles,
  });
});

// PATCH /api/notifications — уншсан болгох.
//   { ids: [...] } | { all: true } | { kind: "tasks" } | { fileId }
export const PATCH = withApiError(async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json().catch(() => null)) as
    | { ids?: unknown; all?: unknown; kind?: unknown; fileId?: unknown }
    | null;
  if (!body) return jsonError("Хүсэлтийн өгөгдөл буруу байна.", 400);

  const where: Prisma.NotificationWhereInput = { userId: user.id, readAt: null };
  if (Array.isArray(body.ids)) {
    const ids = body.ids.filter((id): id is string => typeof id === "string").slice(0, 100);
    if (ids.length === 0) return NextResponse.json({ updated: 0 });
    where.id = { in: ids };
  } else if (body.kind === "tasks") {
    where.type = { in: ["TASK_ASSIGNED", "TASK_DONE"] };
  } else if (typeof body.fileId === "string" && body.fileId) {
    where.fileId = body.fileId;
  } else if (body.all !== true) {
    return jsonError("Юуг уншсан болгохоо заана уу.", 400);
  }

  const { count } = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ updated: count });
});
