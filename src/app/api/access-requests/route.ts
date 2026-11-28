import { jsonError, requireProjectRole, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { pushInApp } from "@/lib/notify";
import { NextResponse } from "next/server";

// POST /api/access-requests { projectId } | { fileId }
// Холбоосоор орж ирээд эрхгүй байсан хүн "Хандах эрх хүсэх" дарна → төслийн
// эзэдэд мэдэгдэл очиж, нэг дарахад тэр хүнийг нэмэх цонх нээгдэнэ.
// Хариу нь төслийн нэр, эзнийг задруулахгүй (эрхгүй хүнд мэдээлэл алдагдахгүй).
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = (await req.json().catch(() => null)) as { projectId?: unknown; fileId?: unknown } | null;
  let projectId = typeof body?.projectId === "string" ? body.projectId : "";
  let fileId: string | null = null;
  if (!projectId && typeof body?.fileId === "string" && body.fileId) {
    const file = await prisma.projectFile.findUnique({
      where: { id: body.fileId },
      select: { projectId: true, name: true },
    });
    if (file) {
      projectId = file.projectId;
      fileId = body.fileId;
    }
  }
  // Байхгүй зүйлд ч ижил хариу — "байгаа эсэх"-ийг таахад ашиглагдахгүй
  const generic = NextResponse.json({ ok: true });
  if (!projectId) return generic;

  if (await requireProjectRole(projectId, user, "VIEWER")) {
    return jsonError("Танд аль хэдийн хандах эрх байна. Хуудсаа шинэчилнэ үү.", 409);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      trashedAt: true,
      members: { where: { role: "OWNER" }, select: { userId: true } },
    },
  });
  if (!project || project.trashedAt || project.members.length === 0) return generic;

  // Нэг хүн нэг төсөлд 24 цагт нэг л удаа хүсэлт илгээнэ (спамгүй)
  const recent = await prisma.notification.findFirst({
    where: {
      type: "ACCESS_REQUEST",
      actorId: user.id,
      projectId,
      createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) return NextResponse.json({ ok: true, already: true });

  const name = user.nickname || user.email || "Хэрэглэгч";
  const params = new URLSearchParams({
    projectId,
    invite: user.id,
    inviteEmail: user.email ?? "",
    inviteName: user.nickname ?? "",
  });
  pushInApp(
    project.members.map((m) => ({
      userId: m.userId,
      type: "ACCESS_REQUEST" as const,
      title: `${name} “${project.name}” төсөлд хандах эрх хүсэж байна`,
      body: "Дарж нэмэх цонхыг нээнэ.",
      url: `/dashboard/project?${params}`,
      actorId: user.id,
      projectId,
      fileId,
    })),
  );
  return generic;
});
