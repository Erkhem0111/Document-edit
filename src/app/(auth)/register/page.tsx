"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nickname, phoneNumber, password }),
      });

      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setError(data.message || "Бүртгэл амжилтгүй боллоо.");
      }
    } catch {
      setError("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vault OS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Шинэ бүртгэл үүсгэх
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Нэр (Nickname)
            </label>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="h-11"
              placeholder="Мэргэжилтэн Бат"
              autoComplete="nickname"
              required
            />
          </div>

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
              Утасны дугаар
            </label>
            <Input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="h-11"
              placeholder="+97699112233"
              autoComplete="tel"
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
              placeholder="8+ тэмдэгт"
              autoComplete="new-password"
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
            {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Бүртгэлтэй юу?{" "}
          <Link
            href="/login"
            className="font-semibold text-foreground hover:underline"
          >
            Нэвтрэх
          </Link>
        </p>
      </div>
    </div>
  );
}
