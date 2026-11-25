// ─── Нэг үндсэн домэйн (www ↔ apex) ──────────────────────────────────────────
// Google нэвтрэлт нь буцах хаягаа үндсэн домэйноор (APP_URL / AUTH_URL) өгдөг.
// Хэрэглэгч www.terralines.mn-ээс эхэлбэл хамгаалалтын (PKCE, state) cookie
// www дээр үлдэж, Google terralines.mn руу буцаахад cookie олдохгүй тул
// нэвтрэлт ҮРГЭЛЖ амжилтгүй болдог. Тиймээс www хувилбарыг үндсэн домэйн руу
// шилжүүлнэ. Зөвхөн www ↔ apex хосыг л харьцуулна — preview (*.vercel.app),
// localhost зэрэг бусад хаягт огт хүрэхгүй.

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

// Шилжүүлэх ёстой бол үндсэн host-ийг, үгүй бол null буцаана
export function canonicalHostFor(
  requestHost: string | null,
  configuredUrl: string | undefined,
): string | null {
  const canonical = hostOf(configuredUrl);
  const current = requestHost?.toLowerCase() ?? null;
  if (!canonical || !current || canonical === current) return null;
  if (current === `www.${canonical}` || canonical === `www.${current}`) return canonical;
  return null;
}
