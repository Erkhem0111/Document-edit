// app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyOTP, validateMongolianPhone } from "@/lib/otp";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json(
        { error: "Дугаар болон код шаардлагатай" },
        { status: 400 },
      );
    }

    const normalizedPhone = validateMongolianPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Буруу утасны дугаар" },
        { status: 400 },
      );
    }

    const result = await verifyOTP(normalizedPhone, code);

    if (!result.success) {
      const messages: Record<string, string> = {
        expired: "Кодны хугацаа дууссан. Дахин авна уу.",
        invalid: "Буруу код. Дахин оролдоно уу.",
        too_many_attempts: "Оролдлого хэтэрсэн. Шинэ OTP авна уу.",
        not_found: "OTP олдсонгүй. Эхлээд код авна уу.",
      };
      return NextResponse.json(
        { error: messages[result.error] ?? "Баталгаажуулалт амжилтгүй" },
        { status: 401 },
      );
    }

    const token = await new SignJWT({
      phone: normalizedPhone,
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const res = NextResponse.json({ success: true });
    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json(
      { error: "Серверт алдаа гарлаа" },
      { status: 500 },
    );
  }
}
