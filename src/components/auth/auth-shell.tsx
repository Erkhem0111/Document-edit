import { TlsLogo } from "@/components/brand/tls-logo";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] px-4 py-8 text-[#101b22]">
      <div className="w-full max-w-md">
        <div className="rounded-[8px] border border-[#d9c58f] bg-white p-6 shadow-xl shadow-[#101b22]/10 sm:p-8">
          <TlsLogo size="lg" showText className="mb-8" />
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-[#64737b]">
              {description}
            </p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
