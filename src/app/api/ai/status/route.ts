import { requireUser, withApiError } from "@/lib/api";
import { NextResponse } from "next/server";

// GET /api/ai/status — AI багц идэвхтэй эсэх. Нийлүүлэгч төлбөрийг
// баталгаажуулсны дараа серверийн тохиргоонд AI_PACKAGE_ENABLED=true болгоно.
export const GET = withApiError(async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({
    enabled: process.env.AI_PACKAGE_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY),
    // Сарын үнэ (₮) — нийлүүлэгч тогтооно, хоосон бол "Тохиролцоно"
    price: process.env.AI_PACKAGE_PRICE_MNT ?? null,
  });
});
