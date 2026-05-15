// middleware.ts — Protected route-уудыг JWT-р хамгаалах
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Хамгаалах шаардлагатай path-ууд
const PROTECTED = ["/dashboard", "/profile", "/settings"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Phone-г header-р дамжуулна — API route-д ашиглаж болно
    const res = NextResponse.next();
    res.headers.set("x-user-phone", payload.phone as string);
    return res;
  } catch {
    // Token хүчингүй эсвэл дууссан
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("auth_token");
    return res;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/settings/:path*"],
};
