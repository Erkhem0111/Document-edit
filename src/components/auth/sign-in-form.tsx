"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { chromeIntentUrl, detectInAppBrowser } from "@/lib/in-app-browser";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Proxy-ийн өгсөн callbackUrl-ийг зөвхөн дотоод зам бол хүлээн авна —
// гадны сайт руу үсэргэх (open redirect) халдлагаас хамгаална.
function useSafeCallbackUrl() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("callbackUrl") ?? "";
  // "//evil.com", "/\\evil.com" зэрэг хөтөч гадны хаяг гэж ойлгодог хэлбэрүүдийг
  // хаана: задласны дараа мөн л энэ сайтын зам байх ёстой
  if (!/^\/(?![\/\\])/.test(raw)) return "/dashboard";
  try {
    const url = new URL(raw, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dashboard";
  }
}

// Google нэвтрэлтийн дараа auth.ts-ээс (status) эсвэл NextAuth-аас (error)
// буцаасан кодыг хэрэглэгчид ойлгомжтой, дараа нь юу хийхийг хэлсэн мессеж болгоно.
// Танигдаагүй код ч гэсэн кодоо харуулна — админ Vercel лог дээр хайж олно.
const STATUS_MESSAGES: Record<string, string> = {
  pending: "Таны бүртгэл үүслээ. Дахин нэвтэрч орно уу.",
  blocked: "Таны эрх хаагдсан байна. Админд хандана уу.",
};

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Нэвтрэх эрхгүй байна. Таны эрх хаагдсан байж магадгүй — админд хандана уу.",
  InvalidCheck:
    "Google-ээс буцах үед хугацаа дууссан эсвэл холболт тасарсан. “Google-ээр нэвтрэх”-ийг дахин дарна уу.",
  OAuthCallbackError:
    "Google нэвтрэлтийг дуусгаж чадсангүй. Дахин оролдоно уу. Давтагдвал өөр хөтчөөр (Chrome, Safari) оролдоно уу.",
  OAuthCallback:
    "Google нэвтрэлтийг дуусгаж чадсангүй. Дахин оролдоно уу. Давтагдвал өөр хөтчөөр (Chrome, Safari) оролдоно уу.",
  CallbackRouteError: "Нэвтрэх үед серверт алдаа гарлаа. Хэсэг хүлээгээд дахин оролдоно уу.",
  OAuthSignin: "Google руу холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.",
  OAuthAccountNotLinked: "Энэ имэйл өөр аргаар бүртгэгдсэн байна. Админд хандана уу.",
  CredentialsSignin: "Имэйл эсвэл нууц үг буруу байна.",
  Configuration: "Нэвтрэх тохиргоонд алдаа байна. Админд мэдэгдэнэ үү.",
};

function useLoginNotice() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");
  if (status && STATUS_MESSAGES[status]) return { tone: "info" as const, text: STATUS_MESSAGES[status] };
  if (error) {
    const text = ERROR_MESSAGES[error] ?? "Нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу.";
    return { tone: "error" as const, text, code: error };
  }
  return null;
}

// navigator зөвхөн browser дээр байдаг — server render болон hydration-д null
const noopSubscribe = () => () => {};
function useInAppBrowser() {
  // Snapshot нь тогтвортой string байх ёстой (объект буцаавал React дахин дахин render хийнэ)
  const userAgent = useSyncExternalStore(
    noopSubscribe,
    () => navigator.userAgent,
    () => "",
  );
  return useMemo(() => (userAgent ? detectInAppBrowser(userAgent) : null), [userAgent]);
}

export function SignInForm() {
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const callbackUrl = useSafeCallbackUrl();
  const notice = useLoginNotice();
  const inApp = useInAppBrowser();

  async function signInWithGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Google руу холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.");
      setGoogleBusy(false);
    }
  }

  return (
    <>
      {inApp && <InAppBrowserNotice app={inApp.app} android={inApp.android} />}

      {notice && !error && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mb-4 rounded-lg p-3 text-center text-xs ${
            notice.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
          }`}
        >
          {notice.text}
          {"code" in notice && notice.code && (
            <span className="mt-1 block opacity-70">Алдааны код: {notice.code}</span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={signInWithGoogle}
        disabled={googleBusy}
      >
        {googleBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
        {googleBusy ? "Google нээж байна…" : "Google-ээр нэвтрэх"}
      </Button>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
        Анх удаа нэвтэрч байгаа бол бүртгэл автоматаар үүснэ. Админ зөвшөөрөх хүртэл зөвхөн өөрийн
        файлуудаа ашиглана.
      </p>

      <div className="mt-6 border-t border-border pt-4">
        {showPassword ? (
          <EmailForm />
        ) : (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
          >
            Админаас нууц үгтэй бүртгэл авсан уу? Нууц үгээр нэвтрэх
          </button>
        )}
      </div>
    </>
  );
}

// Messenger, Facebook зэрэг апп доторх хөтөчид Google нэвтрэлтийг хориглодог
function InAppBrowserNotice({ app, android }: { app: string; android: boolean }) {
  const [copied, setCopied] = useState(false);
  const href = typeof window === "undefined" ? "" : window.location.href;
  const intent = android ? chromeIntentUrl(href) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      window.prompt("Холбоосыг хуулна уу:", href);
    }
  }

  return (
    <div role="alert" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
      <p className="font-semibold">{app} доторх хөтчөөр нээгдсэн байна</p>
      <p className="mt-1">
        Google аюулгүй байдлын үүднээс энд нэвтрэхийг хориглодог. Хуудсыг Chrome эсвэл Safari-аар нээнэ үү:
        {android
          ? " баруун дээд талын ⋮ цэс → “Хөтчөөр нээх” (Open in browser)."
          : " доод/дээд талын ⋯ эсвэл ↗ товч → “Safari-аар нээх” (Open in Safari)."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {intent && (
          <a href={intent} className="rounded-md bg-amber-900 px-3 py-1.5 font-medium text-white">
            Chrome-оор нээх
          </a>
        )}
        <button type="button" onClick={() => void copy()} className="rounded-md border border-amber-400 px-3 py-1.5 font-medium">
          {copied ? "Хуулагдлаа ✓" : "Холбоос хуулах"}
        </button>
      </div>
    </div>
  );
}

// Админы үүсгэсэн нууц үгтэй бүртгэлд (Google хаяггүй хүнд) зориулсан
function EmailForm() {
  const router = useRouter();
  const callbackUrl = useSafeCallbackUrl();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setMessage(
          res.status === 429
            ? "Хэт олон оролдлого. 10 минутын дараа дахин оролдоно уу."
            : "Имэйл эсвэл нууц үг буруу байна. Google хаягаар бүртгүүлсэн бол дээрх “Google-ээр нэвтрэх”-ийг ашиглана уу.",
        );
        setBusy(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setMessage("Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="email">Имэйл</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="нэр@terralines.mn"
          autoComplete="email"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="password">Нууц үг</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          className="mt-1.5"
        />
      </div>
      {message && (
        <p role="alert" className="text-center text-xs text-destructive">
          {message}
        </p>
      )}
      <Button type="submit" variant="outline" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Нууц үгээр нэвтрэх"}
        {!busy && <ArrowRight className="ml-1 size-4" />}
      </Button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.3 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.8 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.7 13-4.6l-6-5.1c-2 1.4-4.4 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.1 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6 5.1c-.4.4 6.7-4.9 6.7-14.4 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
