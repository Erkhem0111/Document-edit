"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { ArrowRight, Globe, LockKeyhole, Mail } from "lucide-react";
import { AuthField } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
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
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label="И-мэйл хаяг" icon={<Mail />}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-[8px] border-[#d8c58f] bg-[#fbfaf7] pl-10"
            placeholder="name@company.com"
            autoComplete="email"
            required
          />
        </AuthField>
        <AuthField label="Нууц үг" icon={<LockKeyhole />}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-[8px] border-[#d8c58f] bg-[#fbfaf7] pl-10"
            placeholder="Нууц үгээ оруулна уу"
            autoComplete="current-password"
            required
          />
        </AuthField>
        {error && (
          <p className="rounded-[8px] bg-destructive/10 p-3 text-center text-xs text-destructive">
            {error}
          </p>
        )}
        <Button className="h-11 w-full bg-[#101b22] hover:bg-[#1a2b35]" disabled={loading}>
          {loading ? "Уншиж байна..." : "Нэвтрэх"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1 bg-[#e3d4a7]" />
        <span className="text-xs text-[#7d704f]">эсвэл</span>
        <Separator className="flex-1 bg-[#e3d4a7]" />
      </div>
      <Button variant="outline" onClick={handleGoogleLogin} disabled={loading} className="h-11 w-full">
        <Globe className="size-4" />
        Google-ээр нэвтрэх
      </Button>
      <p className="mt-6 text-center text-sm text-[#64737b]">
        Бүртгэлгүй юу?{" "}
        <Link href="/register" className="font-semibold text-[#101b22] hover:underline">
          Бүртгүүлэх
        </Link>
      </p>
    </>
  );
}
