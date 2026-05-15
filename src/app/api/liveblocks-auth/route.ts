import { auth } from "@/lib/auth";
import { canAccessFile, getFileAccessRecord } from "@/lib/api";
import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const requestBody = (await req.json().catch(() => ({}))) as { room?: string };
  const room = typeof requestBody.room === "string" ? requestBody.room : "";
  const fileId = room.startsWith("file:") ? room.slice(5) : "";
  const file = fileId ? await getFileAccessRecord(fileId) : null;

  if (!file || !canAccessFile(file, { id: session.user.id, role: session.user.role })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { message: "LIVEBLOCKS_SECRET_KEY is not configured." },
      { status: 500 },
    );
  }

  const liveblocks = new Liveblocks({ secret });
  const liveblocksSession = liveblocks.prepareSession(session.user.id, {
    userInfo: {
      name: session.user.name ?? session.user.email ?? "TLS user",
      color: "#b88926",
    },
  });

  liveblocksSession.allow(room, liveblocksSession.FULL_ACCESS);
  const { status, body } = await liveblocksSession.authorize();

  return new Response(body, { status });
}
