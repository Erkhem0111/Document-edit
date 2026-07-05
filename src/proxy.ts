import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ─── Хатуу хамгаалалтын proxy (Next 16-д middleware-ийн шинэ нэр) ────────────
// Дүрэм: доорх PUBLIC_PAGES-ээс бусад БҮХ хуудас нэвтрэлт шаардана.
// Шинэ хуудас нэмэхэд автоматаар хамгаалагдана (fail-closed).

const PUBLIC_PAGES = new Set([
  "/", // танилцуулга хуудас
  "/login",
  "/forgot-password", // нууц үг сэргээх (ирээдүйд)
  "/reset-password",
]);

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY"); // iframe дотор оруулахыг хориглоно
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

// Session JWT cookie-г шалгана. Ямар нэг алдаа гарвал "нэвтрээгүй" гэж
// үзнэ (fail-closed) — алдаанаас болж хамгаалалт нээгдэхгүй.
async function getSession(request: NextRequest) {
  try {
    if (!process.env.AUTH_SECRET) return null;
    return await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: request.nextUrl.protocol === "https:",
    });
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // NextAuth-ийн өөрийн route-ууд (нэвтрэх/гарах урсгал) — чөлөөтэй
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const session = await getSession(request);

  // API: нэвтрээгүй хүсэлтэд ямар ч өгөгдөл өгөхгүй шууд 401
  // (route бүрийн requireUser дээр нэмээд давхар хаалт)
  if (pathname.startsWith("/api")) {
    if (!session) {
      return NextResponse.json(
        { message: "Нэвтэрсэн байх шаардлагатай." },
        { status: 401 },
      );
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Нэвтэрсэн хэрэглэгч /login руу орвол dashboard руу буцаана
  if (session && pathname === "/login") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  // Хамгаалалттай хуудас + нэвтрээгүй → /login (буцаж очих хаягаа дагуулна)
  if (!session && !PUBLIC_PAGES.has(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");
    return applySecurityHeaders(response);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Статик asset-уудаас (зураг, icon г.м.) бусад бүх зам дээр ажиллана —
  // /api замууд ч мөн хамрагдана
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)",
  ],
};
