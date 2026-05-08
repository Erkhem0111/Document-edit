import Link from "next/link";
import { ArrowRight, FileCheck2, FolderKanban, ShieldCheck } from "lucide-react";
import { TlsLogo } from "@/components/brand/tls-logo";
import { Button } from "@/components/ui/button";

const highlights = [
  { icon: FolderKanban, label: "Төслүүд", text: "Файл, даалгавар, гишүүдийг нэг дор." },
  { icon: FileCheck2, label: "Баримт", text: "Хувилбар, түгжээ, сэтгэгдэлтэй ажиллана." },
  { icon: ShieldCheck, label: "Эрх", text: "Компанийн хэрэглэгчийн эрхээр хамгаална." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#101b22]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TlsLogo size="sm" />
            <div>
              <p className="text-sm font-semibold text-[#101b22]">Terra Line Survey</p>
              <p className="text-xs text-[#687780]">Document workspace</p>
            </div>
          </div>
          <Button asChild variant="outline" className="border-[#d8c58f] bg-white">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <TlsLogo size="hero" showText />
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.28em] text-[#9a711d]">
            TLS Workspace
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Газрын хэмжилт, төслийн баримт бичгийг нэг орчинд.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#61717a]">
            Terra Line Survey-ийн баг файл, төсөл, даалгавар, сэтгэгдлээ
            цэгцтэй удирдах дотоод систем.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 bg-[#101b22] px-6 hover:bg-[#1a2b35]">
              <Link href="/login">
                Sign in
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 border-[#d8c58f] bg-white px-6">
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 pb-5 md:grid-cols-3">
          {highlights.map(({ icon: Icon, label, text }) => (
            <div key={label} className="rounded-[8px] border border-[#e0cf9c] bg-white/80 p-4">
              <Icon className="mb-3 size-5 text-[#9a711d]" />
              <p className="font-semibold">{label}</p>
              <p className="mt-1 text-sm leading-6 text-[#64737b]">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
