import { requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureRoomSeeded, liveblocksClient } from "@/lib/collab-doc";
import { NextResponse } from "next/server";

export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const requestBody = (await req.json().catch(() => ({}))) as { room?: string };
  const room = typeof requestBody.room === "string" ? requestBody.room : "";
  const fileId = room.startsWith("file:") ? room.slice(5) : "";
  const file = fileId
    ? await prisma.projectFile.findUnique({
        where: { id: fileId },
        select: {
          projectId: true,
          isLocked: true,
          lockedById: true,
          project: { select: { visibility: true } },
        },
      })
    : null;

  if (!file) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // Хандах эрхийг project-ийн visibility-ээр шалгана
  const canView = await requireProjectRole(file.projectId, user, "VIEWER");
  if (!canView) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  // Өөр хүн lock хийсэн бол (contents PATCH-тэй ижил дүрэм) зөвхөн уншина —
  // эс бөгөөс DB-д хадгалагдахгүй ч Liveblocks өрөөнд засвар үлдэж зөрдөг
  const lockedByOther =
    file.isLocked && file.lockedById !== user.id && user.role !== "ADMIN";
  const canEdit =
    !lockedByOther
      ? await requireProjectRole(file.projectId, user, "EDITOR")
      : null;

  const liveblocks = liveblocksClient();
  if (!liveblocks) {
    return NextResponse.json(
      { message: "LIVEBLOCKS_SECRET_KEY is not configured." },
      { status: 500 },
    );
  }

  // Хэн нэг холбогдохоос ӨМНӨ өрөөг DB-ийн агуулгаар (хоосон бол) нэг удаа
  // бөглөнө. Алдаа гарвал нэвтрүүлсээр байна — клиент sync болсны дараа өрөө
  // хоосон байвал өөрөө бөглөдөг нөөц арга хэвээр (өмнөх зан төлөв).
  try {
    await ensureRoomSeeded(liveblocks, fileId);
  } catch (error) {
    console.warn("Liveblocks room seed failed:", error);
  }
  const liveblocksSession = liveblocks.prepareSession(user.id, {
    userInfo: {
      name: user.nickname ?? user.email ?? "TLS user",
      color: "#b88926",
    },
  });

  // Засах эрхтэй бол FULL_ACCESS, эс бөгөөс зөвхөн унших (read-only)
  liveblocksSession.allow(
    room,
    canEdit ? liveblocksSession.FULL_ACCESS : liveblocksSession.READ_ACCESS,
  );
  const { status, body } = await liveblocksSession.authorize();

  return new Response(body, { status });
});
