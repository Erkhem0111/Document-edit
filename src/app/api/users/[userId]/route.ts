import { jsonError, requireUser, withApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = Promise<{ userId: string }>;

const GLOBAL_ROLES = ["ADMIN", "ENGINEER"] as const;

// PATCH /api/users/[userId]  { role?, isActive? } — зөвхөн ADMIN.
// Өөрийгөө өөрчлөхийг хориглоно — сүүлийн админ өөрийгөө түгжихээс сэргийлнэ.
export const PATCH = withApiError(async function PATCH(req: Request, context: { params: Params }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ADMIN") {
    return jsonError("Зөвхөн админ хэрэглэгчдийг удирдана.", 403);
  }

  const { userId } = await context.params;
  if (userId === user.id) {
    return jsonError("Өөрийн эрхийг эндээс өөрчлөх боломжгүй.", 400);
  }

  const body = await req.json().catch(() => ({}));
  const role = GLOBAL_ROLES.includes(body.role) ? body.role : undefined;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
  if (role === undefined && isActive === undefined) {
    return jsonError("Өөрчлөх зүйл алга.", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: { id: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ user: updated });
});
