"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, KeyRound, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SignInForm() {
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setGoogleBusy(true);
    setError("");

    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setError("Google sign-in failed");
      setGoogleBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-center text-xs text-destructive">
          {error}
        </p>
      )}

      <Button
        variant="outline"
        className="w-full border-border bg-card hover:bg-accent"
        onClick={signInWithGoogle}
        disabled={googleBusy}
      >
        <GoogleIcon />
        {googleBusy ? "Opening Google..." : "Continue with Google"}
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> or{" "}
        <div className="h-px flex-1 bg-border" />
      </div>

      <Tabs defaultValue="email">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">
            <Mail className="mr-1.5 size-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="phone">
            <Phone className="mr-1.5 size-3.5" />
            Phone
          </TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="mt-5">
          <EmailForm />
        </TabsContent>
        <TabsContent value="phone" className="mt-5">
          <PhoneForm />
        </TabsContent>
      </Tabs>
    </>
  );
}

function EmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    if (mode === "up") {
      setMessage(
        "Account creation is handled by Google sign-in or an admin account.",
      );
      setBusy(false);
      return;
    }

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setMessage("Email or password is incorrect.");
      setBusy(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.co"
          autoComplete="email"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className="mt-1.5"
        />
      </div>
      {message && (
        <p className="text-center text-xs text-muted-foreground">{message}</p>
      )}
      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground"
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "in" ? (
          "Sign In"
        ) : (
          "Create account"
        )}
        {!busy && <ArrowRight className="ml-1 size-4" />}
      </Button>
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setMode((current) => (current === "in" ? "up" : "in"));
        }}
        className="block w-full text-center text-xs text-muted-foreground hover:text-primary"
      >
        {mode === "in"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

function PhoneForm() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"send" | "verify">("send");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(
      "Phone sign-in needs a NextAuth SMS provider before it can send codes.",
    );
    setStage("verify");
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("Phone verification is not configured yet.");
    setBusy(false);
  }

  return stage === "send" ? (
    <form onSubmit={send} className="space-y-4">
      <div>
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+976 9911 2233"
          autoComplete="tel"
          className="mt-1.5"
        />
      </div>
      {message && (
        <p className="text-center text-xs text-muted-foreground">{message}</p>
      )}
      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground"
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            Send code <ArrowRight className="ml-1 size-4" />
          </>
        )}
      </Button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-4">
      <div>
        <Label htmlFor="otp">Verification code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="123456"
          className="mt-1.5"
        />
      </div>
      {message && (
        <p className="text-center text-xs text-muted-foreground">{message}</p>
      )}
      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground"
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <KeyRound className="mr-1 size-4" />
            Verify & Sign In
          </>
        )}
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
