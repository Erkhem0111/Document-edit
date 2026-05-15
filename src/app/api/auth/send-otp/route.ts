// app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  generateOTP,
  saveOTP,
  canSendOTP,
  validateMongolianPhone,
} from "@/lib/otp";
import { sendSMS } from "@/lib/sms";

// IP-based rate limit (Redis байхгүй үед хялбар хамгаалалт)
const ipRequests = new Map<string, { count: number; resetAt: number }>();

function checkIPRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = ipRequests.get(ip);
  if (!rec || now > rec.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (rec.count >= 10) return false; // 1 минутад 10 request
  rec.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // IP rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkIPRateLimit(ip)) {
      return NextResponse.json(
        { error: "Хэт олон хүсэлт. 1 минут хүлээнэ үү." },
        { status: 429 },
      );
    }

    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json(
        { error: "Утасны дугаар шаардлагатай" },
        { status: 400 },
      );
    }

    const normalizedPhone = validateMongolianPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Зөв Монгол дугаар оруулна уу" },
        { status: 400 },
      );
    }

    // Cooldown шалгах — 60 секундэд нэг л код
    const allowed = await canSendOTP(normalizedPhone);
    if (!allowed) {
      return NextResponse.json(
        { error: "Хэт олон удаа. 60 секунд хүлээгээд дахин оролдоно уу." },
        { status: 429 },
      );
    }

    const otp = generateOTP();
    await saveOTP(normalizedPhone, otp);
    await sendSMS(
      normalizedPhone,
      `Таны нэвтрэх код: ${otp}\n5 минутын дотор хүчинтэй.`,
    );

    return NextResponse.json({
      success: true,
      message: "OTP код илгээгдлээ",
      ...(process.env.NODE_ENV === "development" && { debug_otp: otp }),
    });
  } catch (err) {
    console.error("send-otp error:", err);
    return NextResponse.json(
      { error: "OTP илгээхэд алдаа гарлаа" },
      { status: 500 },
    );
  }
}
