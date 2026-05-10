import { TlsLogo } from "@/components/brand/tls-logo";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative">
          <TlsLogo size="sm" showText className="text-primary-foreground" />
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl leading-tight">
            Field-tested.
            <br />
            Office-ready.
          </h2>
          <p className="mt-3 max-w-md text-primary-foreground/70">
            One workspace for every survey, every map, every coordinate.
          </p>
        </div>
        <div className="relative text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Terra Line Survey
        </div>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <TlsLogo size="sm" showText />
          </div>
          <h1 className="font-display text-3xl text-primary">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">
          {children}
          </div>
        </div>
      </section>
    </main>
  );
}
