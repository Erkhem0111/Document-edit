import { requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Liveblocks } from "@liveblocks/node";
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
        select: { projectId: true, project: { select: { visibility: true } } },
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
  const canEdit =
    file.project.visibility !== "REFERENCE"
      ? await requireProjectRole(file.projectId, user, "EDITOR")
      : null;

  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { message: "LIVEBLOCKS_SECRET_KEY is not configured." },
      { status: 500 },
    );
  }

  const liveblocks = new Liveblocks({ secret });
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
