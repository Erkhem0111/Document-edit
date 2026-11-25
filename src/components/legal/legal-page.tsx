import Link from "next/link";
import { TlsLogo } from "@/components/brand/tls-logo";

// Нууцлалын бодлого, үйлчилгээний нөхцөлийн нийтлэг хүрээ — нэвтрэлтгүй
// нээгддэг (Google OAuth-ийн consent screen эдгээр холбоосыг шаарддаг).
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Terra Line нүүр">
            <TlsLogo size="sm" showText />
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
            Нэвтрэх
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 [&_h2]:mt-8 [&_h2]:font-sans [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        <h1 className="font-display text-3xl text-primary">{title}</h1>
        <p className="text-sm text-muted-foreground">Сүүлд шинэчилсэн: {updated}</p>
        {children}
      </article>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} Terra Line Survey</span>
          <Link href="/privacy" className="hover:text-primary">
            Нууцлалын бодлого
          </Link>
          <Link href="/terms" className="hover:text-primary">
            Үйлчилгээний нөхцөл
          </Link>
        </div>
      </footer>
    </main>
  );
}
