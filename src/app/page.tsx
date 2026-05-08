import Link from "next/link";
import {
  ArrowRight,
  FileCheck2,
  ShieldCheck,
  Layers3,
  Ruler,
  Map,
  Compass,
  Satellite,
  Mountain,
} from "lucide-react";
import { TlsLogo } from "@/components/brand/tls-logo";
import { Button } from "@/components/ui/button";

const highlights = [
  {
    icon: Ruler,
    label: "Хэмжилтийн нарийвчлал",
    text: "Газрын хэмжилт, координат, тайлангийн файлуудыг нэг дор хадгална.",
  },
  {
    icon: Map,
    label: "Төслийн зураглал",
    text: "Кадастр, байр зүйн зураг, талбайн мэдээллээ цэгцтэй удирдана.",
  },
  {
    icon: ShieldCheck,
    label: "Эрхийн хамгаалалт",
    text: "Файл, төсөл, багийн гишүүдийн хандалтыг найдвартай хянана.",
  },
];

const projectFiles = [
  "Topographic survey.pdf",
  "Boundary coordinates.xlsx",
  "Cadastral map.dwg",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f1e8] text-[#101b22]">
      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/70 px-5 pb-14 pt-5 shadow-2xl shadow-[#101b22]/10 backdrop-blur md:px-10 lg:px-12">
          <div className="absolute left-1/2 top-12 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#d8c58f]/25 blur-3xl" />
          <div className="absolute right-10 top-40 h-[260px] w-[260px] rounded-full bg-[#101b22]/10 blur-3xl" />

          <nav className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TlsLogo size="sm" />
              <div>
                <p className="text-sm font-semibold">Terra Line Survey</p>
                <p className="text-xs text-[#687780]">Geodesy workspace</p>
              </div>
            </div>

            <div className="hidden items-center gap-8 text-sm font-medium text-[#5f6e76] md:flex">
              <Link href="#services" className="hover:text-[#101b22]">
                Үйлчилгээ
              </Link>
              <Link href="#method" className="hover:text-[#101b22]">
                Аргачлал
              </Link>
              <Link href="#projects" className="hover:text-[#101b22]">
                Төслүүд
              </Link>
            </div>

            <Button
              asChild
              className="rounded-xl bg-[#101b22] px-6 text-white hover:bg-[#1a2b35]"
            >
              <Link href="/login">
                Нэвтрэх
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </nav>

          <div className="relative z-10 grid items-center gap-12 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.45em] text-[#0d6070]">
                Terra Line Survey
              </p>

              <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
                Геодезийн төсөл, хэмжилтийн баримтаа нэг орчинд.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-[#61717a] sm:text-lg">
                Талбайн хэмжилт, кадастрын зураг, тайлан, зөвшөөрөл болон
                төслийн файлуудаа баг дотроо хурдан, цэгцтэй удирдах workspace.
              </p>

              <Button
                asChild
                className="mt-8 h-12 rounded-xl bg-[#0d6070] px-7 hover:bg-[#084d5a]"
              >
                <Link href="/login">
                  Workspace руу орох
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="relative mx-auto grid w-full max-w-xl grid-cols-[1.2fr_0.65fr_0.55fr] gap-4">
              <div className="relative h-[420px] overflow-hidden rounded-[2rem] bg-[#d8c58f]/30 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
                  alt="Geodesy field landscape"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="h-[420px] overflow-hidden rounded-[2rem] bg-[#d8c58f]/30 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=700&q=80"
                  alt="Survey engineer working"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="h-[420px] overflow-hidden rounded-[2rem] bg-[#101b22] shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=700&q=80"
                  alt="Mapping view"
                  className="h-full w-full object-cover opacity-80"
                />
              </div>

              <div className="absolute -left-6 top-8 flex items-center gap-3 rounded-2xl bg-[#0d6070] px-4 py-3 text-white shadow-lg">
                <Compass className="size-5" />
                <span className="font-semibold">GPS Survey</span>
              </div>

              <div className="absolute -bottom-6 left-16 flex items-center gap-3 rounded-2xl bg-[#0d6070] px-4 py-3 text-white shadow-lg">
                <Satellite className="size-5" />
                <span className="font-semibold">Coordinate Data</span>
              </div>

              <div className="absolute -right-5 top-40 flex items-center gap-3 rounded-2xl bg-[#0d6070] px-4 py-3 text-white shadow-lg">
                <Mountain className="size-5" />
                <span className="font-semibold">Terrain Mapping</span>
              </div>
            </div>
          </div>
        </div>

        <section
          id="services"
          className="grid gap-10 px-2 py-20 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <div>
            <h2 className="text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Газрын хэмжилтэд зориулсан{" "}
              <span className="text-[#0d6070]">цэгцтэй систем</span>
            </h2>

            <div className="mt-8 inline-flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm">
              <ArrowRight className="size-7 text-[#0d6070]" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {highlights.map(({ icon: Icon, label, text }) => (
              <div
                key={label}
                className="rounded-3xl border border-[#e0cf9c] bg-white/75 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#101b22]/5"
              >
                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-[#f1e6c5] text-[#0d6070]">
                  <Icon className="size-7" />
                </div>
                <h3 className="text-xl font-semibold">{label}</h3>
                <p className="mt-3 text-sm leading-6 text-[#64737b]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="projects"
          className="grid items-center gap-12 pb-20 lg:grid-cols-2"
        >
          <div>
            <h2 className="text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              Төсөл бүрийн файл, зураг, тайлангаа алдахгүй.
            </h2>

            <div className="mt-8 space-y-5 border-l-2 border-[#d8c58f] pl-6">
              <div>
                <p className="text-sm text-[#0d6070]">01</p>
                <h3 className="mt-2 font-semibold">
                  Хэмжилтийн датагаа нэг дор
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#64737b]">
                  Координат, зураг, тайлан, зөвшөөрлийн файлуудыг төсөл тус
                  бүрээр ангилж хадгална.
                </p>
              </div>

              <div>
                <p className="text-sm text-[#0d6070]">02</p>
                <h3 className="mt-2 font-semibold">Багийн хамтын ажиллагаа</h3>
                <p className="mt-2 text-sm leading-6 text-[#64737b]">
                  Хэн ямар файл нэмсэн, шинэчилсэн, баталгаажуулсан гэдгийг
                  хялбар хянана.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e0cf9c] bg-white/75 p-5 shadow-2xl shadow-[#101b22]/10 backdrop-blur-xl">
            <div className="rounded-[1.5rem] bg-[#101b22] p-5 text-white">
              <div className="flex items-center justify-between">
                <TlsLogo size="sm" />
                <Layers3 className="size-5 text-[#d8c58f]" />
              </div>

              <div className="mt-10">
                <p className="text-sm text-white/60">Active project</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Field Survey Documents
                </h2>
              </div>

              <div className="mt-8 space-y-3">
                {projectFiles.map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-2xl bg-white/10 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item}</p>
                      <p className="text-xs text-white/45">Updated recently</p>
                    </div>
                    <FileCheck2 className="size-4 text-[#d8c58f]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
