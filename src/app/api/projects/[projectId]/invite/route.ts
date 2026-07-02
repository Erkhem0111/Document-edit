import {
  jsonError,
  requireProjectRole,
  requireUser,
  withApiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite-code";
import { NextResponse } from "next/server";

type Params = Promise<{ projectId: string }>;

// GET — одоогийн урих кодыг авах (owner)
export const GET = withApiError(async function GET(_req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Эрхгүй.", 403);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true, inviteCode: true },
  });
  if (!project) return jsonError("Төсөл олдсонгүй.", 404);
  if (project.visibility !== "SHARED") {
    return jsonError("Урих код зөвхөн Shared folder-т ажиллана.", 400);
  }

  return NextResponse.json({ inviteCode: project.inviteCode });
});

// POST — код үүсгэх / шинэчлэх (owner). body.rotate=true бол шинэ код өгнө.
export const POST = withApiError(async function POST(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { projectId } = await context.params;
  const membership = await requireProjectRole(projectId, user, "OWNER");
  if (!membership) return jsonError("Эрхгүй.", 403);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { visibility: true, inviteCode: true },
  });
  if (!project) return jsonError("Төсөл олдсонгүй.", 404);
  if (project.visibility !== "SHARED") {
    return jsonError("Урих код зөвхөн Shared folder-т ажиллана.", 400);
  }

  const body = await req.json().catch(() => ({}));
  const rotate = body?.rotate === true;

  // Код байхгүй эсвэл шинэчлэх хүсэлт → шинэ давтагдашгүй код үүсгэнэ
  let inviteCode = project.inviteCode;
  if (!inviteCode || rotate) {
    // Давхцахгүй болтол дахин үүсгэнэ (маш ховор)
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateInviteCode();
      const exists = await prisma.project.findUnique({
        where: { inviteCode: candidate },
        select: { id: true },
      });
      if (!exists) {
        inviteCode = candidate;
        break;
      }
    }
    await prisma.project.update({
      where: { id: projectId },
      data: { inviteCode },
    });
  }

  return NextResponse.json({ inviteCode });
});
