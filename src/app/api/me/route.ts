import { jsonError, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      nickname: true,
      phoneNumber: true,
      avatarUrl: true,
      role: true,
    },
  });

  if (!profile) return jsonError("Хэрэглэгч олдсонгүй.", 404);

  return NextResponse.json({ user: profile });
});

// PATCH /api/me  { nickname } — өөрийн профайл засах
export const PATCH = withApiError(async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  if (typeof body.nickname !== "string") {
    return jsonError("Өөрчлөх зүйл алга.", 400);
  }
  // Хоосон бол null — нэргүй болгож имэйлээ харуулна
  const nickname = body.nickname.trim().slice(0, 40) || null;

  try {
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: { nickname },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        role: true,
      },
    });
    return NextResponse.json({ user: profile });
  } catch (err) {
    // nickname unique тул давхардвал ойлгомжтой алдаа буцаана
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return jsonError("Энэ нэрийг өөр хэрэглэгч авсан байна.", 409);
    }
    throw err;
  }
});
