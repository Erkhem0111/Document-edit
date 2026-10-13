import { requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/users/directory — компанийн идэвхтэй хэрэглэгчдийн жагсаалт
// (хуваалцахад хүн сонгоход). Зөвхөн нэр, имэйл, зураг — эрх, нэвтрэлтийн
// мэдээлэл буцаахгүй. Нэвтэрсэн хэрэглэгч бүр харна (дотоод систем).
export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, nickname: true, avatarUrl: true },
    orderBy: [{ nickname: "asc" }, { email: "asc" }],
    take: 1000,
  });
  return NextResponse.json({ users });
});
