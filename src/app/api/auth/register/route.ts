import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

const MIN_PASSWORD_LENGTH = 8;

function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.replace(/[\s()-]/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const nickname =
      typeof body.nickname === "string" ? body.nickname.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const phoneNumber =
      typeof body.phoneNumber === "string"
        ? normalizePhoneNumber(body.phoneNumber)
        : "";

    if (!email || !nickname || !phoneNumber || !password) {
      return NextResponse.json(
        { message: "Бүх талбарыг бөглөнө үү." },
        { status: 400 },
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { message: "И-мэйл хаяг буруу байна." },
        { status: 400 },
      );
    }

    if (!/^\+?\d{8,15}$/.test(phoneNumber)) {
      return NextResponse.json(
        { message: "Утасны дугаараа зөв оруулна уу." },
        { status: 400 },
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `Нууц үг хамгийн багадаа ${MIN_PASSWORD_LENGTH} тэмдэгт байна.` },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        nickname,
        phoneNumber,
        passwordHash: hashedPassword,
        role: "ENGINEER",
      },
    });

    return NextResponse.json(
      { message: "Амжилттай бүртгэгдлээ" },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const fields = Array.isArray(error.meta?.target)
        ? error.meta.target
        : [];
      const message = fields.includes("email")
        ? "Энэ и-мэйл бүртгэлтэй байна."
        : fields.includes("nickname")
          ? "Энэ nickname бүртгэлтэй байна."
          : fields.includes("phoneNumber")
            ? "Энэ утасны дугаар бүртгэлтэй байна."
            : "Бүртгэл давхцаж байна.";

      return NextResponse.json({ message }, { status: 409 });
    }

    console.error("Registration failed", error);
    return NextResponse.json({ message: "Алдаа гарлаа" }, { status: 500 });
  }
}
