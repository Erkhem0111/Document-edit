import { requireUser, withApiError } from "@/lib/api";
import { ensurePersonalWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";

// POST /api/workspace/personal — "Миний баримтууд" төслийн id (байхгүй бол үүсгэнэ).
// Нүүр хуудаснаас төсөл сонгохгүйгээр файл оруулахад ашиглана.
export const POST = withApiError(async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const projectId = await ensurePersonalWorkspace(user.id);
  return NextResponse.json({ projectId });
});
