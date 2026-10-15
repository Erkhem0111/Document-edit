"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Ban,
  Bot,
  Check,
  ChevronRight,
  ClipboardList,
  FileSearch,
  FileText,
  KanbanSquare,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

// ─── AI туслах (нэмэлт багц) ─────────────────────────────────────────────────
// Бүх зүйл гараар хийгдэх боломжтой хэвээр. AI нь бичих, бөглөх ажлыг хурдасгах
// сонголтот багц. Төлбөр: хүсэлт → нэхэмжлэх → төлбөр баталгаажмагц нийлүүлэгч
// серверийн тохиргоонд асаана (QPay гэрээ хийгдтэл гараар).
// Хуудасны зорилго: шийдвэр гаргагч "авах уу, үгүй юу"-гаа ойлгоод шийдэх.

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessageSquare,
    title: "1. Та энгийнээр бичнэ",
    text: "Баруун доод буланд гарах цонхонд хүнд хэлж байгаа шигээ монголоор бичнэ. Тусгай команд сурах шаардлагагүй.",
  },
  {
    icon: Bot,
    title: "2. AI бэлдэж харуулна",
    text: "Юу хийх гэж байгаагаа урьдчилан харуулна: ямар ажил үүсгэх, хэнд оноох, ямар текст бичих гэх мэт.",
  },
  {
    icon: ThumbsUp,
    title: "3. Та “Тийм” дарна",
    text: "Таны зөвшөөрөлгүйгээр юу ч өөрчлөгдөхгүй. Засах зүйл байвал “Огноог 11/05 болго” гэж хэлэхэд л болно.",
  },
];

type Example = { icon: LucideIcon; area: string; ask: string; reply: string; saves: string };

const EXAMPLES: Example[] = [
  {
    icon: KanbanSquare,
    area: "Ажил бүртгэх",
    ask: "Хан-Уулын 15-р хороонд Тэнгэр ХХК-ийн кадастрын хэмжилт, 10/30-нд хүлээлгэж өгнө. Батаад оноо.",
    reply:
      "“Хан-Уул 15-р хороо — кадастр” ажил үүсгэнэ: захиалагч Тэнгэр ХХК, хугацаа 10/30, шат Захиалга. Батад “Хээрийн хэмжилт” даалгавар оноох уу?",
    saves: "Ажлын карт, төсөл, даалгаврыг тусад нь бөглөх 3–4 минут",
  },
  {
    icon: ClipboardList,
    area: "Даалгавар",
    ask: "Энэ долоо хоногт надад юу хийх үлдсэн бэ?",
    reply:
      "Танд 4 даалгавар байна. Хамгийн яаралтай нь “Зайсан — зураг төсөл” (маргааш дуусна). 1 даалгаврын хугацаа 2 хоног хэтэрсэн.",
    saves: "Жагсаалт гүйлгэж шүүх шаардлагагүй",
  },
  {
    icon: FileText,
    area: "Тайлан бичих",
    ask: "Сонгинохайрханы ажлын координатын файлаар хэмжилтийн тайлангийн ноорог бич.",
    reply:
      "Компанийн загвараар ноорог үүсгэлээ: талбай 1,245.6 м², 12 цэг, UTM 48. Багажийн дугаар олдсонгүй — [шалгах] гэж тэмдэглэв.",
    saves: "Тайлангийн эхний ноорог 30–60 минутаас хэдхэн минут",
  },
  {
    icon: FileSearch,
    area: "Файл хайх",
    ask: "Өнгөрсөн сард Баянзүрхэд хийсэн газар өмчлөлийн гэрээ хаана байна?",
    reply: "“Баянзүрх 26-р хороо, газар өмчлөл” төслийн “Гэрээ” хавтаст 2 файл олдлоо. Нээх үү?",
    saves: "Хавтас хавтсаар хайх цаг",
  },
  {
    icon: MapPin,
    area: "Координат",
    ask: "Энэ файлын талбай гэрчилгээнийхээс хэр зөрүүтэй вэ?",
    reply: "Тооцоолсон талбай 1,245.6 м², гэрчилгээнд 1,240 м². Зөрүү +5.6 м² (0.45%) — зөвшөөрөгдөх хэмжээнд.",
    saves: "Харагч руу орж тооцоолох алхам",
  },
  {
    icon: Wrench,
    area: "Багаж, зөвшөөрөл",
    ask: "Ойрын 2 сард ямар багажийн баталгаажуулалт дуусах вэ?",
    reply: "Leica TS06 (11/12) болон GNSS хүлээн авагч №2 (12/03). Баталгаажуулалтын даалгавар үүсгэх үү?",
    saves: "Хугацаа мартаж торгууль, саатал гарахаас сэргийлнэ",
  },
];

const SAFETY = [
  "Хүн бүр зөвхөн өөрийн эрхээр — таны харж чадахгүй файлыг AI ч харахгүй",
  "Өөрчлөлт бүр таны “Тийм” дарснаар л хийгдэнэ",
  "Устгах эрх огт байхгүй — AI юу ч устгаж чадахгүй",
  "Тоо, баримт зохиохгүй — олдоогүй мэдээллийг [шалгах] гэж тэмдэглэнэ",
  "Хүн бүрт өдрийн хязгаар, компанид сарын зардлын дээд хязгаар",
];

const LIMITS = [
  "Хээрийн хэмжилт, зураг төслийн мэргэжлийн шийдвэрийг таны оронд гаргахгүй",
  "Албан бичгийг шууд илгээхгүй — зөвхөн ноорог бэлдэнэ",
  "Интернэт холболтгүй үед ажиллахгүй (систем өөрөө гараар ажилласаар байна)",
];

const FAQ = [
  {
    q: "Авахгүй бол юу алдах вэ?",
    a: "Юу ч алдахгүй. Бүх боломж гараар ажилласаар байна. AI нь зөвхөн бичих, бөглөх, хайх ажлыг хурдасгана.",
  },
  {
    q: "Манай файлууд хаашаа явах вэ?",
    a: "Хүсэлт тавьсан тэр мөчид хэрэгтэй хэсэг нь л AI үйлчилгээ рүү илгээгдэнэ. AI-г сургахад ашиглагдахгүй, үйлчилгээ үзүүлэгчийн журмын дагуу зөвхөн богино хугацаанд хадгалагдана.",
  },
  {
    q: "Монгол хэлийг сайн ойлгох уу?",
    a: "Тийм. Кирилл болон латинаар бичсэн монгол хэлийг ойлгоно. Мэргэжлийн нэр томьёог (кадастр, UTM, тахеометр) мэднэ.",
  },
  {
    q: "Дунд нь зогсоож болох уу?",
    a: "Болно. Сар бүр төлөх тул дараа сард нь сунгахгүй бол багц автоматаар унтарна.",
  },
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

      <div className="mt-5 grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Танилцуулга */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
              <Sparkles className="h-3 w-3" /> Нэмэлт багц · заавал биш
            </span>
            <h2 className="mt-3 font-display text-2xl text-primary md:text-3xl">
              Хүнд хэлж байгаа шигээ бичихэд системийн ажлыг хийж өгдөг туслах
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Terra Line Workspace-ийн бүх боломж гараар ажилладаг. Харин ажил бүртгэх, даалгавар оноох,
              тайлан ноороглох, файл хайх зэрэг өдөр бүр давтагддаг ажилд олон товч дарж, олон талбар
              бөглөх шаардлагатай. AI туслах нь эдгээрийг таны нэг өгүүлбэрээс ойлгож, бэлдээд, таны
              зөвшөөрлөөр гүйцэтгэнэ. Шинэ ажилтан системийг сурахгүйгээр шууд ашиглаж эхэлнэ.
            </p>
          </section>

          {/* Яаж ажилладаг */}
          <section>
            <SectionTitle>Яг яаж ажилладаг вэ</SectionTitle>
            <div className="grid gap-3 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-sans text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Жишээнүүд */}
          <section>
            <SectionTitle>Жишээ: та юу бичиж, юу авах вэ</SectionTitle>
            <div className="grid gap-3 xl:grid-cols-2">
              {EXAMPLES.map(({ icon: Icon, area, ask, reply, saves }) => (
                <div key={area} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className="h-4 w-4 text-violet-600" /> {area}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <p className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-sm">{ask}</p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100">
                      <Bot className="h-3.5 w-3.5 text-violet-700" />
                    </span>
                    <p className="rounded-2xl rounded-tl-sm border border-violet-200 bg-violet-50/60 px-3.5 py-2 text-sm">
                      {reply}
                    </p>
                  </div>
                  <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
                    <span className="font-medium text-teal">Хэмнэх зүйл:</span> {saves}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Аюулгүй байдал + хязгаар */}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="flex items-center gap-2 font-sans text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-teal" /> Аюулгүй байдал
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed">
                {SAFETY.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-teal" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="flex items-center gap-2 font-sans text-sm font-semibold">
                <Ban className="h-4 w-4 text-muted-foreground" /> AI юу хийхгүй вэ
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                {LIMITS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Түгээмэл асуулт */}
          <section>
            <SectionTitle>Түгээмэл асуулт</SectionTitle>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-5 py-3.5">
                  <summary className="flex list-none items-center text-sm font-medium">
                    {q}
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* Багц, хүсэлт */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-5">
          <div className="flex items-center">
            <h2 className="font-sans text-base font-semibold">AI багц</h2>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                status?.enabled ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
              }`}
            >
              {status == null ? "…" : status.enabled ? "Идэвхтэй" : "Идэвхгүй"}
            </span>
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {price}
            {status?.price && <span className="text-xs font-normal text-muted-foreground"> / сар</span>}
          </div>
          <ul className="mt-3 space-y-1.5 text-xs">
            {[
              "Компанийн бүх хэрэглэгчид",
              "Хүн бүрт өдөрт 30 хүсэлт",
              "Сарын зардлын дээд хязгаартай",
              "Сар бүр — хүссэн үедээ зогсооно",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="h-3.5 w-3.5 text-violet-600" />
                {t}
              </li>
            ))}
          </ul>

          {status?.enabled ? (
            <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Багц идэвхтэй. AI туслах удахгүй баруун доод буланд гарч ирнэ.
            </p>
          ) : (
            <>
              <h3 className="mt-5 font-sans text-xs font-medium text-muted-foreground">Хэрхэн идэвхжүүлэх вэ</h3>
              <ol className="mt-1.5 space-y-1 rounded-lg bg-muted p-3 text-xs leading-relaxed">
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
                rows={3}
                maxLength={1000}
                placeholder="Асуух зүйл, нэмэлт тайлбар (заавал биш)"
                className="mt-3 w-full resize-none rounded-lg border border-border bg-background p-2.5 text-xs outline-none focus:ring-1 focus:ring-violet-300"
              />
              <Button
                className="mt-2 w-full bg-violet-700 text-white hover:bg-violet-800"
                disabled={busy || sent}
                onClick={() => void request()}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sent ? "Хүсэлт илгээгдсэн ✓" : isAdmin ? "Хүсэлт илгээх" : "Админд хүсэлт илгээх"}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Хүсэлт илгээх нь төлбөр биш — эхлээд тохиролцоно.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-sans text-sm font-semibold text-foreground">{children}</h2>;
}
