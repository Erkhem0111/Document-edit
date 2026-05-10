import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  FileText,
  Folder,
  FolderLock,
  FolderOpen,
  FolderTree,
  Lock,
  Map,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { TlsLogo } from "@/components/brand/tls-logo";
import { Button } from "@/components/ui/button";

const folders = [
  {
    icon: FolderOpen,
    name: "Нийтийн фолдер",
    desc: "Бүх хэрэглэгч орж харж болох нийтэд нээлттэй материалууд.",
    tone: "teal",
  },
  {
    icon: Users,
    name: "Урилгатай фолдер",
    desc: "Зөвхөн урьсан хэрэглэгчид харах, ашиглах боломжтой төслийн фолдер.",
    tone: "gold",
  },
  {
    icon: FolderLock,
    name: "Хувийн фолдер",
    desc: "Зөвхөн өөрөө харах хувийн файл, тэмдэглэл, материал хадгалах хэсэг.",
    tone: "primary",
  },
  {
    icon: Archive,
    name: "Архив",
    desc: "Дууссан төслүүд болон одоо идэвхтэй ашиглагдахгүй файлуудыг эмхтэй хадгална.",
    tone: "teal",
  },
  {
    icon: ShieldCheck,
    name: "Reference",
    desc: "Харах боломжтой ч засах, устгах эрхгүй лавлах материалын фолдер.",
    tone: "gold",
  },
  {
    icon: Trash2,
    name: "Trash",
    desc: "Устгасан эсвэл түр хадгалсан файлуудыг шалгах хэсэг.",
    tone: "primary",
  },
] as const;

const features = [
  {
    icon: Database,
    title: "Нэгдсэн файл хадгалалт",
    desc: "Зураг, хэмжилтийн файл, тайлан, кадастрын материал болон компанийн дотоод бичиг баримтыг нэг дор хадгална.",
  },
  {
    icon: Lock,
    title: "Эрхийн түвшинтэй фолдер",
    desc: "Нийтийн, урилгатай, хувийн, архив, reference болон trash бүтэцтэйгээр хандалтыг удирдана.",
  },
  {
    icon: Cloud,
    title: "Хаанаас ч ажиллах боломж",
    desc: "Оффис, талбай, гэрээсээ эсвэл өөр компьютерээс файлууд руугаа шууд хандаж ажиллана.",
  },
  {
    icon: FileText,
    title: "Docs шиг засварлах орчин",
    desc: "Файл дээр дарахад цэвэрхэн document editor нээгдэж, харах, засах, ажиллах боломжтой.",
  },
] as const;

const steps = [
  [
    "01",
    "Нэвтрэх",
    "Google account эсвэл email/password ашиглан компанийн workspace руу нэвтэрнэ.",
  ],
  [
    "02",
    "Фолдер үүсгэх",
    "Фолдерын нэр, өнгө, харах хүмүүсийг сонгож төслийн бүтэц үүсгэнэ.",
  ],
  [
    "03",
    "Файл байрлуулах",
    "DWG, PDF, зураг, тайлан болон хэмжилтийн файлуудаа тохирох фолдерт хадгална.",
  ],
  [
    "04",
    "Хаанаас ч нээх",
    "Sidebar, folder card эсвэл search ашиглан хүссэн файлаа шууд олж нээнэ.",
  ],
] as const;

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" aria-label="Terra Line home">
            <TlsLogo size="sm" showText />
          </Link>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a
              href="#features"
              className="text-muted-foreground transition hover:text-primary"
            >
              Боломжууд
            </a>
            <a
              href="#folders"
              className="text-muted-foreground transition hover:text-primary"
            >
              Фолдер бүтэц
            </a>
            <a
              href="#workspace"
              className="text-muted-foreground transition hover:text-primary"
            >
              Workspace
            </a>
            <a
              href="#security"
              className="text-muted-foreground transition hover:text-primary"
            >
              Аюулгүй байдал
            </a>
          </nav>

          <Button
            asChild
            className="h-10 bg-primary px-5 text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/login">
              Нэвтрэх
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-teal/10 blur-3xl" />
        <div className="absolute right-10 top-40 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-soft">
              <span className="size-1.5 rounded-full bg-teal" />
              Геодезийн инженерүүдэд зориулсан file workspace
            </span>

            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-primary sm:text-6xl lg:text-7xl">
              Төслийн бичиг баримтаа
              <br />
              нэг <span className="italic text-teal">цэгцтэй</span>{" "}
              <span className="italic text-gold">орчинд</span>.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Зураг, хэмжилтийн файл, тайлан, кадастрын материал болон компанийн
              дотоод бичиг баримтаа нэг database дээр хадгалж, хаанаас ч
              компьютерээ нээгээд ажиллах боломжтой.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 bg-primary px-7 text-primary-foreground shadow-card hover:bg-primary/90"
              >
                <Link href="/login">
                  Ажлын орчин руу нэвтрэх
                  <ArrowRight className="size-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-primary/20 px-7"
              >
                <a href="#workspace">Дэлгэрэнгүй үзэх</a>
              </Button>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-teal" />
                Эрхийн түвшинтэй
              </div>
              <div className="flex items-center gap-2">
                <FolderTree className="size-4 text-teal" />
                File tree бүтэцтэй
              </div>
              <div className="flex items-center gap-2">
                <Search className="size-4 text-teal" />
                Шууд хайлттай
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <HeroWorkspacePreview />
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-border/60 bg-card/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.25em] text-teal">
              Боломжууд
            </p>
            <h2 className="mt-3 font-display text-4xl text-primary">
              Геодезийн компанийн өдөр тутмын файл зохион байгуулалтад
              зориулсан.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <article
                key={title}
                className="rounded-2xl border border-border bg-background p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 font-display text-xl text-primary">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="folders" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.25em] text-teal">
              Фолдер бүтэц
            </p>
            <h2 className="mt-3 font-display text-4xl text-primary">
              Default 6 фолдер + хүссэнээрээ нэмэх боломж.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Нэвтэрсний дараа хэрэглэгч folder card-уудыг харна. Фолдер бүр
              өөрийн үүрэгтэй бөгөөд хандах эрх, харагдах байдал, хадгалах
              зорилгоороо ялгаатай.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/25 bg-background p-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg text-primary">
                    Шинэ фолдер
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Нэр, өнгө, харах хүмүүсээ сонгоод өөр folder card үүсгэнэ.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {folders.map(({ icon: Icon, name, desc, tone }) => (
            <article
              key={name}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div
                className="flex size-12 items-center justify-center rounded-xl"
                style={{
                  backgroundColor:
                    tone === "teal"
                      ? "color-mix(in oklch, var(--teal) 16%, transparent)"
                      : tone === "gold"
                        ? "color-mix(in oklch, var(--gold) 35%, transparent)"
                        : "color-mix(in oklch, var(--primary) 12%, transparent)",
                  color:
                    tone === "teal"
                      ? "var(--teal)"
                      : tone === "gold"
                        ? "var(--gold-foreground)"
                        : "var(--primary)",
                }}
              >
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 font-display text-xl text-primary">{name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="workspace" className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold">
              Workspace
            </p>
            <h2 className="mt-3 font-display text-4xl">
              Sidebar, file tree, search, storage — хэрэгтэй зүйлс л байна.
            </h2>
            <p className="mt-5 leading-7 text-primary-foreground/70">
              Dashboard дээр илүүц widget байхгүй. Зүүн талд фолдерын мод, голд
              folder card болон file list, баруун доод хэсэгт багтаамжийн жижиг
              card байрлана.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-primary-foreground/80">
              {[
                "Фолдер бүр triangle arrow-той, дарахад file list нь доош задарна.",
                "Файл руу sidebar-аас эсвэл folder card-аас орж болно.",
                "Search хэсгээр файл, төслийн материалыг хурдан олно.",
                "Фолдер үүсгэхэд @ бичээд database дээрх user-үүдээс сонгоно.",
              ].map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <DashboardMockup />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.25em] text-teal">
            Ажиллах зарчим
          </p>
          <h2 className="mt-3 font-display text-4xl text-primary">
            Файл хадгалахаас document editor хүртэл нэг урсгалтай.
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, title, desc]) => (
            <li
              key={n}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="font-display text-3xl text-gold">{n}</div>
              <h3 className="mt-3 font-display text-xl text-primary">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {desc}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section id="security" className="border-y border-border/60 bg-card/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-teal">
              Аюулгүй байдал
            </p>
            <h2 className="mt-3 font-display text-4xl text-primary">
              Компанийн дотоод файлд зориулсан хамгаалалттай орчин.
            </h2>
            <p className="mt-5 leading-7 text-muted-foreground">
              Хэрэглэгч эхлээд landing page харна. Workspace руу орохын тулд
              Google account эсвэл email/password ашиглан нэвтэрнэ. Нэвтэрсний
              дараа зөвхөн өөрт зөвшөөрөгдсөн фолдер, файл харагдана.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-background p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-display text-xl text-primary">
                  Access control
                </h3>
                <p className="text-sm text-muted-foreground">
                  Фолдер бүр тусдаа эрхтэй
                </p>
              </div>
              <ShieldCheck className="size-9 text-teal" />
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["Нийтийн", "Бүх хэрэглэгч харна"],
                ["Урилгатай", "Зөвхөн сонгосон хүмүүс"],
                ["Хувийн", "Зөвхөн өөрөө"],
                ["Reference", "Харна, засахгүй"],
              ].map(([name, desc]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="font-medium text-primary">{name}</span>
                  <span className="text-sm text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-teal">
            Эхлэхэд бэлэн
          </p>
          <h2 className="mt-4 font-display text-4xl text-primary sm:text-5xl">
            Төслийн бичиг баримтаа нэг дор цэгцэлж эхлээрэй.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">
            Геодезийн багийн өдөр тутмын файл солилцоо, хадгалалт, хайлт,
            засварлалт бүгд нэг workspace дотор.
          </p>

          <Button
            asChild
            size="lg"
            className="mt-8 h-12 bg-primary px-8 text-primary-foreground shadow-card hover:bg-primary/90"
          >
            <Link href="/login">
              Нэвтрэх
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <TlsLogo size="sm" showText />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Terra Line Survey. Бүх эрх хуулиар
            хамгаалагдсан.
          </p>
        </div>
      </footer>
    </main>
  );
}

function HeroWorkspacePreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-teal/20 via-transparent to-gold/20 blur-2xl" />

      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border bg-background/70 px-5 py-4">
          <span className="size-2.5 rounded-full bg-teal/70" />
          <span className="size-2.5 rounded-full bg-gold/80" />
          <span className="size-2.5 rounded-full bg-primary/40" />
          <span className="ml-3 text-xs text-muted-foreground">
            terra-line.workspace
          </span>
        </div>

        <div className="grid grid-cols-[130px_1fr]">
          <aside className="border-r border-border bg-background/60 p-4">
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <Search className="size-3.5" />
              Хайх...
            </div>

            <div className="space-y-2 text-xs">
              {["Нийтийн", "Урилгатай", "Хувийн", "Архив"].map((name, i) => (
                <div key={name}>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground">
                    <ChevronDown className="size-3" />
                    <Folder
                      className={
                        i === 1 ? "size-3.5 text-gold" : "size-3.5 text-teal"
                      }
                    />
                    {name}
                  </div>
                  {i === 0 && (
                    <div className="ml-7 mt-1 space-y-1 text-[10px] text-muted-foreground/70">
                      <div>site-plan.pdf</div>
                      <div>gnss-data.geo</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg text-primary">Dashboard</h3>
                <p className="text-xs text-muted-foreground">
                  Фолдер болон файлын нэгдсэн харагдац
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 bg-primary text-primary-foreground"
              >
                <Plus className="size-3.5" />
                Folder
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                "Нийтийн",
                "Урилгатай",
                "Хувийн",
                "Архив",
                "Reference",
                "Trash",
              ].map((name, i) => (
                <div
                  key={name}
                  className="rounded-xl border border-border bg-background p-3 shadow-soft"
                >
                  <div
                    className="mb-3 flex size-8 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor:
                        i % 3 === 0
                          ? "color-mix(in oklch, var(--teal) 18%, transparent)"
                          : i % 3 === 1
                            ? "color-mix(in oklch, var(--gold) 35%, transparent)"
                            : "color-mix(in oklch, var(--primary) 12%, transparent)",
                    }}
                  >
                    <Folder className="size-4 text-primary" />
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {(i + 2) * 4} файл
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium text-primary">68%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[68%] rounded-full bg-teal" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="font-display text-xl">Folder workspace</h3>
          <p className="text-sm text-primary-foreground/60">
            card view + file tree
          </p>
        </div>
        <Map className="size-8 text-gold" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[150px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3 text-xs text-primary-foreground/50">
            File tree
          </div>
          {["Нийтийн", "Урилгатай", "Хувийн"].map((item) => (
            <div
              key={item}
              className="mb-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
            >
              ▾ {item}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {[
            "2026-05-10 site-measurement.pdf",
            "boundary-plan.dwg",
            "field-report.docx",
          ].map((file) => (
            <div
              key={file}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
            >
              <FileText className="size-4 text-gold" />
              <span className="text-sm">{file}</span>
            </div>
          ))}

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-primary-foreground/60">Багтаамж</span>
              <span>68%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-full w-[68%] rounded-full bg-gold" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
