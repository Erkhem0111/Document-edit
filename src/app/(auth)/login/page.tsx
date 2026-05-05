"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("И-мэйл эсвэл нууц үг буруу байна.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vault OS</h1>
          <p className="mt-2 text-sm text-muted-foreground">Системд нэвтрэх</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              И-мэйл хаяг
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              placeholder="name@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Нууц үг
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              placeholder="Нууц үгээ оруулна уу"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 p-3 text-center text-xs text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full"
          >
            {loading ? "Уншиж байна..." : "Нэвтрэх"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">Эсвэл</span>
          <Separator className="flex-1" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="h-11 w-full"
        >
          Google-ээр нэвтрэх
        </Button>

        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Vault OS. Бүх эрх хуулиар хамгаалагдсан.
          </p>
        </div>
      </div>
    </div>
  );
}
