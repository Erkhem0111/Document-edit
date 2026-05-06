import { jsonError, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
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
}
