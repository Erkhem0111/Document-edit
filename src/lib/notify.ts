import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// ─── Имэйл мэдэгдэл ──────────────────────────────────────────────────────────
// Хэрэглэгчийг сайт руу буцааж дуудах гол хэрэгсэл: task оноогдох, comment
// бичигдэх, төсөлд нэмэгдэх үед имэйл очно.
//
// • after() — имэйлийг хариу (response) буцаасны ДАРАА илгээнэ. Тиймээс
//   хэрэглэгч имэйл илгээгдэхийг хүлээхгүй, Resend удаан/алдаатай байсан ч
//   үйлдэл нь амжилттай болно.
// • RESEND_API_KEY тохируулаагүй бол sendEmail чимээгүй false буцаана —
//   хөгжүүлэлтийн орчинд юу ч эвдрэхгүй.

type Recipient = { email: string; nickname?: string | null };
type Actor = { email?: string; nickname?: string | null };

function displayName(person: Actor | Recipient) {
  return person.nickname || person.email || "Хэрэглэгч";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Имэйл доторх холбоосын бүтэн хаяг. APP_URL (жишээ: https://workspace.terralines.mn)
// тохируулаагүй бол хүсэлт ирсэн хаягийг ашиглана.
export function getAppOrigin(req: Request) {
  const configured = process.env.APP_URL ?? process.env.AUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

function layout({
  heading,
  body,
  ctaUrl,
  ctaLabel,
}: {
  heading: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
}) {
  return `<!doctype html>
<html lang="mn"><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e7e5e4">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#0f766e">Terra Line Workspace</div>
    <h1 style="font-size:20px;margin:10px 0 14px">${heading}</h1>
    <div style="font-size:14px;line-height:1.6">${body}</div>
    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:20px;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">${ctaLabel}</a>
    <p style="margin-top:24px;font-size:11px;color:#78716c">Энэ мэдэгдэл Terra Line Workspace-ээс автоматаар илгээгдлээ.</p>
  </div>
</body></html>`;
}

type Message = { to: string; subject: string; html: string };

// Хариу буцаасны дараа илгээнэ; нэг имэйл амжилтгүй болсон ч бусад нь явна.
function queue(messages: Message[]) {
  if (messages.length === 0) return;
  after(async () => {
    const results = await Promise.allSettled(messages.map((m) => sendEmail(m)));
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error("Notification email failed:", messages[i].to, result.reason);
      }
    });
  });
}

function quote(text: string) {
  const short = text.length > 400 ? `${text.slice(0, 400)}…` : text;
  return `<blockquote style="margin:12px 0;padding:10px 14px;background:#f5f5f4;border-left:3px solid #0f766e;border-radius:4px;white-space:pre-wrap">${escapeHtml(short)}</blockquote>`;
}

// ─── Task оноогдсон ──────────────────────────────────────────────────────────
export function notifyTaskAssigned({
  origin,
  actor,
  assignee,
  task,
  projectName,
}: {
  origin: string;
  actor: Actor;
  assignee: Recipient;
  task: { title: string; dueDate?: Date | null };
  projectName: string;
}) {
  const due = task.dueDate
    ? `<br>Дуусгах хугацаа: <b>${task.dueDate.toISOString().slice(0, 10)}</b>`
    : "";
  queue([
    {
      to: assignee.email,
      subject: `Танд даалгавар оноогдлоо: ${task.title}`,
      html: layout({
        heading: "Танд шинэ даалгавар оноогдлоо",
        body: `<b>${escapeHtml(displayName(actor))}</b> танд <b>${escapeHtml(projectName)}</b> төсөлд даалгавар оноолоо:${quote(task.title)}${due}`,
        ctaUrl: `${origin}/dashboard/tasks`,
        ctaLabel: "Даалгавар харах",
      }),
    },
  ]);
}

// ─── Файл дээр comment бичигдсэн ─────────────────────────────────────────────
// Хүлээн авагчид: файлыг оруулсан хүн + тухайн thread-д оролцсон хүмүүс
// (reply бол эх comment-ын эзэн болон бусад хариулсан хүмүүс). Бичсэн хүн
// өөрөө мэдэгдэл авахгүй.
export async function notifyComment({
  origin,
  actor,
  actorId,
  file,
  parentId,
  content,
}: {
  origin: string;
  actor: Actor;
  actorId: string;
  file: { id: string; name: string; projectId: string; uploaderId: string };
  parentId: string | null;
  content: string;
}) {
  const recipientIds = new Set<string>([file.uploaderId]);

  if (parentId) {
    const thread = await prisma.comment.findMany({
      where: { OR: [{ id: parentId }, { parentId }] },
      select: { userId: true },
    });
    thread.forEach((c) => recipientIds.add(c.userId));
  }
  recipientIds.delete(actorId);
  if (recipientIds.size === 0) return;

  const recipients = await prisma.user.findMany({
    where: { id: { in: [...recipientIds] }, isActive: true },
    select: { email: true, nickname: true },
  });

  const url = `${origin}/dashboard/file?folderId=${file.projectId}&fileId=${file.id}`;
  const verb = parentId ? "сэтгэгдэлд хариулав" : "сэтгэгдэл бичлээ";
  queue(
    recipients.map((r) => ({
      to: r.email,
      subject: `${displayName(actor)} "${file.name}" дээр ${verb}`,
      html: layout({
        heading: `"${escapeHtml(file.name)}" дээр шинэ сэтгэгдэл`,
        body: `<b>${escapeHtml(displayName(actor))}</b> ${verb}:${quote(content)}`,
        ctaUrl: url,
        ctaLabel: "Файлыг нээх",
      }),
    })),
  );
}

// ─── Төсөлд нэмэгдсэн ────────────────────────────────────────────────────────
export function notifyMemberAdded({
  origin,
  actor,
  member,
  project,
  role,
}: {
  origin: string;
  actor: Actor;
  member: Recipient;
  project: { id: string; name: string };
  role: string;
}) {
  const roleLabel = role === "EDITOR" ? "засах" : role === "OWNER" ? "эзэмшигчийн" : "харах";
  queue([
    {
      to: member.email,
      subject: `${displayName(actor)} таныг "${project.name}" төсөлд нэмлээ`,
      html: layout({
        heading: "Таныг төсөлд нэмлээ",
        body: `<b>${escapeHtml(displayName(actor))}</b> таныг <b>${escapeHtml(project.name)}</b> төсөлд <b>${roleLabel}</b> эрхтэйгээр нэмлээ.`,
        ctaUrl: `${origin}/dashboard/project?projectId=${project.id}`,
        ctaLabel: "Төсөл нээх",
      }),
    },
  ]);
}

// ─── Шинэ хэрэглэгч зөвшөөрөл хүлээж байна (admin-уудад) ────────────────────
export async function notifyAdminsPendingUser({
  origin,
  email,
}: {
  origin: string;
  email: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { email: true },
  });
  queue(
    admins.map((admin) => ({
      to: admin.email,
      subject: `Шинэ хэрэглэгч зөвшөөрөл хүлээж байна: ${email}`,
      html: layout({
        heading: "Шинэ хэрэглэгч зөвшөөрөл хүлээж байна",
        body: `<b>${escapeHtml(email)}</b> Google-ээр нэвтрэхийг оролдлоо. Таньдаг хүн бол Хэрэглэгчид хуудаснаас зөвшөөрнө үү.`,
        ctaUrl: `${origin}/dashboard/admin`,
        ctaLabel: "Хэрэглэгчид хуудас",
      }),
    })),
  );
}

// ─── Admin зөвшөөрсөн (хэрэглэгчид) ──────────────────────────────────────────
export function notifyUserApproved({
  origin,
  user,
}: {
  origin: string;
  user: Recipient;
}) {
  queue([
    {
      to: user.email,
      subject: "Таны бүртгэл баталгаажлаа",
      html: layout({
        heading: "Тавтай морил!",
        body: "Admin таны бүртгэлийг зөвшөөрлөө. Одоо Google-ээр нэвтэрч ажиллах боломжтой.",
        ctaUrl: `${origin}/login`,
        ctaLabel: "Нэвтрэх",
      }),
    },
  ]);
}
