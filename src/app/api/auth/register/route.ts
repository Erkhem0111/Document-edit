import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, nickname, password } = await req.json();

    // Хэрэглэгч бүртгэлтэй эсэхийг шалгах
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ message: "Энэ и-мэйл бүртгэлтэй байна." }, { status: 400 });
    }

    // Нууц үг нууцлах
    const hashedPassword = await bcrypt.hash(password, 10);

    // Датабэйс рүү хадгалах
    const user = await prisma.user.create({
      data: {
        email,
        nickname,
        passwordHash: hashedPassword,
        role: "ENGINEER", // Default role
      },
    });

    return NextResponse.json({ message: "Амжилттай бүртгэгдлээ" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Алдаа гарлаа" }, { status: 500 });
  }
}