"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

// ─── AI туслах (нэмэлт багц) ─────────────────────────────────────────────────
// Бүх зүйл гараар хийгдэх боломжтой хэвээр. AI нь бичих, бөглөх ажлыг хурдасгах
// сонголтот багц. Төлбөр: хүсэлт → нэхэмжлэх → төлбөр баталгаажмагц нийлүүлэгч
// серверийн тохиргоонд асаана (QPay гэрээ хийгдтэл гараар).

const EXAMPLES = [
  {
    ask: "Шинэ ажил: Хан-Уул, Тэнгэр ХХК, 10/30, кадастр",
    does: "Ажлын картыг бөглөөд “Үүсгэх үү?” гэж асууна.",
  },
  { ask: "Надад юу оноогдсон бэ?", does: "Даалгавруудыг хугацаагаар нь эрэмбэлж товч хэлнэ." },
  {
    ask: "Энэ CSV-ээр тайлангийн ноорог бич",
    does: "Загвараар ноороглоно. Тоо зохиохгүй — олдоогүй мэдээллийг [шалгах] гэж тэмдэглэнэ.",
  },
];

const SAFETY = [
  "Хэрэглэгч өөрийн эрхээр л — харж чадахгүй файлыг AI ч харахгүй",
  "Өөрчлөлт бүрийг “Тийм” дарж баталгаажуулна",
  "Устгах эрх огт байхгүй",
  "Хүн бүрт өдрийн хязгаар, компанид сарын зардлын дээд хязгаар",
];

export default function AiPackagePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [status, setStatus] = useState<{ enabled: boolean; price: string | null } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d ?? { enabled: false, price: null }))
      .catch(() => setStatus({ enabled: false, price: null }));
  }, []);

  async function request() {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? "Илгээж чадсангүй.");
      toast.success(body?.message ?? "Илгээгдлээ");
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Илгээж чадсангүй.");
    } finally {
      setBusy(false);
    }
  }

  const price = status?.price ? `₮${Number(status.price).toLocaleString("en-US")}` : "Тохиролцоно";

  return (
    <div className="px-4 py-5 md:px-8">
      <h1 className="flex items-center gap-1.5 font-sans text-lg md:text-xl">
        <Link href="/dashboard/tools" className="text-muted-foreground hover:text-foreground">
          Хэрэгслүүд
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Sparkles className="h-4 w-4 text-violet-600" /> AI туслах
      </h1>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Бүх зүйлийг гараар хийх боломж хэвээр. AI нь бичих, бөглөх ажлыг хурдасгах нэмэлт — заавал биш.
      </p>

      <div className="mt-5 grid max-w-5xl gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 font-sans text-xs font-medium text-muted-foreground">AI юу хийдэг вэ</h2>
            <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
              {EXAMPLES.map((e) => (
                <div key={e.ask} className="flex gap-2.5">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <div>
                    <div className="font-medium text-foreground">“{e.ask}”</div>
                    <div className="text-xs text-muted-foreground">→ {e.does}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-2 font-sans text-xs font-medium text-muted-foreground">Аюулгүй байдал</h2>
            <ul className="space-y-1.5 rounded-xl border border-border bg-card p-4 text-xs">
              {SAFETY.map((s) => (
                <li key={s} className="flex gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal" />
                  {s}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="h-fit rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="flex items-center">
            <h2 className="font-sans text-base font-medium">AI багц</h2>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                status?.enabled ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
              }`}
            >
              {status == null ? "…" : status.enabled ? "Идэвхтэй" : "Идэвхгүй"}
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {price}
            {status?.price && <span className="text-xs font-normal text-muted-foreground"> / сар</span>}
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {["Компанийн бүх хэрэглэгчид", "Хүн бүрт өдөрт 30 хүсэлт", "Сарын зардлын дээд хязгаартай"].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="h-3.5 w-3.5 text-violet-600" />
                {t}
              </li>
            ))}
          </ul>

          {status?.enabled ? (
            <p className="mt-4 rounded-lg bg-white p-3 text-xs text-muted-foreground">
              Багц идэвхтэй. AI туслах удахгүй баруун доод буланд гарч ирнэ.
            </p>
          ) : (
            <>
              <h3 className="mt-4 text-xs font-medium text-muted-foreground">Хэрхэн идэвхжүүлэх вэ</h3>
              <ol className="mt-1.5 space-y-1 rounded-lg bg-white p-3 text-xs leading-relaxed">
                {isAdmin ? (
                  <>
                    <li>1. “Хүсэлт илгээх” → нийлүүлэгчид мэдэгдэл очно</li>
                    <li>2. Нэхэмжлэх ирнэ → дансаар төлнө</li>
                    <li>3. Төлбөр баталгаажмагц багц асна</li>
                  </>
                ) : (
                  <>
                    <li>1. “Админд хүсэлт илгээх” → админд имэйл очно</li>
                    <li>2. Админ шийдвэрлэж, багцыг идэвхжүүлнэ</li>
                  </>
                )}
              </ol>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Нэмэлт тайлбар (заавал биш)"
                className="mt-3 w-full resize-none rounded-lg border border-border bg-white p-2.5 text-xs outline-none focus:ring-1 focus:ring-violet-300"
              />
              <Button
                className="mt-2 w-full bg-violet-700 text-white hover:bg-violet-800"
                disabled={busy || sent}
                onClick={() => void request()}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sent ? "Хүсэлт илгээгдсэн ✓" : isAdmin ? "Хүсэлт илгээх" : "Админд хүсэлт илгээх"}
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
