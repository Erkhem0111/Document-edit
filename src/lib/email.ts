// Имэйл илгээх — Resend-ийн REST API-г шууд дууддаг (SDK шаардлагагүй).
// RESEND_API_KEY тохируулаагүй бол false буцаана — дуудсан газар нь
// хэрэглэгчид ойлгомжтой алдаа үзүүлнэ.
//
// EMAIL_FROM жишээ: "TLS Workspace <noreply@terralines.mn>"
// (terralines.mn-ийг Resend дээр баталгаажуулсны дараа; түүнээс өмнө
// туршилтад "onboarding@resend.dev" хаягийг ашиглаж болно)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from =
    process.env.EMAIL_FROM ?? "TLS Workspace <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    console.error("Resend error:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}
