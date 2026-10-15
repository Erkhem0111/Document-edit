// Хэрэглэгчийн IP-г тодорхойлно.
// x-forwarded-for-ийн ЭХНИЙ утгыг client өөрөө хуурамчаар бичиж болдог тул
// (rate limit-ийг тойрох) proxy/hosting-ийн өөрийн тавьсан x-real-ip-г
// түрүүлж, үгүй бол хамгийн сүүлд нэмэгдсэн (ойрын proxy-ийн харсан) утгыг авна.
export function getClientIp(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}
