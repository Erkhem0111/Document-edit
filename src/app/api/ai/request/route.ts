import { requireUser, withApiError, jsonError } from "@/lib/api";
import { getAppOrigin, notifyAiPackageRequest } from "@/lib/notify";
import { NextResponse } from "next/server";

// Нэг хүн цагт нэг л хүсэлт илгээнэ (имэйл спамаас сэргийлнэ)
const lastRequest = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000;

// POST /api/ai/request { message? } — идэвхжүүлэх хүсэлт
export const POST = withApiError(async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const last = lastRequest.get(user.id) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return jsonError("Хүсэлт аль хэдийн илгээгдсэн. Түр хүлээнэ үү.", 429);
  }

  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  const isAdmin = user.role === "ADMIN";
  const sent = await notifyAiPackageRequest({ origin: getAppOrigin(req), requester: user, isAdmin, message });
  if (sent === 0) {
    return jsonError(
      isAdmin
        ? "Нийлүүлэгчийн имэйл (AI_PACKAGE_CONTACT_EMAIL) тохируулаагүй байна."
        : "Админ олдсонгүй.",
      400,
    );
  }
  lastRequest.set(user.id, Date.now());
  return NextResponse.json({ message: isAdmin ? "Хүсэлт нийлүүлэгчид илгээгдлээ." : "Хүсэлт админд илгээгдлээ." });
});
