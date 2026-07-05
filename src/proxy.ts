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

function applySecurityHeaders(response: NextResponse, isHttps: boolean) {
  response.headers.set("X-Frame-Options", "DENY"); // iframe дотор оруулахыг хориглоно
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isHttps) {
    // Нэг удаа https-ээр орсон browser цаашид хэзээ ч http ашиглахгүй
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return response;
}

// ─── Brute-force хязгаарлагч (in-memory) ─────────────────────────────────────
// Нууц үг таах (login) болон урих код таах (join) оролдлогыг IP бүрээр
// хязгаарлана. Serverless instance бүрт тусдаа тоологдох ч халуун instance
// дээр таалтыг мэдэгдэхүйц удаашруулна.
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/auth/callback/credentials": { max: 10, windowMs: 10 * 60 * 1000 },
  "/api/projects/join": { max: 20, windowMs: 10 * 60 * 1000 },
};
const attempts = new Map<string, number[]>();

function isRateLimited(pathname: string, request: NextRequest): boolean {
  const rule = RATE_LIMITS[pathname];
  if (!rule || request.method !== "POST") return false;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${pathname}:${ip}`;
  const now = Date.now();

  // Санах ой хэт өсөхөөс сэргийлж хааяа бүхэлд нь цэвэрлэнэ
  if (attempts.size > 5000) attempts.clear();

  const recent = (attempts.get(key) ?? []).filter(
    (time) => now - time < rule.windowMs,
  );
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > rule.max;
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
  const isHttps = request.nextUrl.protocol === "https:";

  // Нууц үг/урих код таах оролдлогыг хязгаарлана
  if (isRateLimited(pathname, request)) {
    return NextResponse.json(
      { message: "Хэт олон оролдлого — түр хүлээгээд дахин оролдоно уу." },
      { status: 429 },
    );
  }

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
    return applySecurityHeaders(NextResponse.next(), isHttps);
  }

  // Нэвтэрсэн хэрэглэгч /login руу орвол dashboard руу буцаана
  if (session && pathname === "/login") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/dashboard", request.url)),
      isHttps,
    );
  }

  // Хамгаалалттай хуудас + нэвтрээгүй → /login (буцаж очих хаягаа дагуулна)
  if (!session && !PUBLIC_PAGES.has(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("Cache-Control", "no-store");
    return applySecurityHeaders(response, isHttps);
  }

  return applySecurityHeaders(NextResponse.next(), isHttps);
}

export const config = {
  // Статик asset-уудаас (зураг, icon г.м.) бусад бүх зам дээр ажиллана —
  // /api замууд ч мөн хамрагдана
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)",
  ],
};
