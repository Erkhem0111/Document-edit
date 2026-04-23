"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="w-full max-w-md p-8 bg-white rounded-[24px] shadow-sm border border-[#E9ECEF]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-black rounded-xl mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-[#212529]">Vault OS</h1>
          <p className="text-[#6C757D] text-sm mt-2">Системд нэвтрэх</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#495057] mb-2">
              И-мэйл хаяг
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#DEE2E6] focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
              placeholder="name@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#495057] mb-2">
              Нууц үг
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#DEE2E6] focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs bg-red-50 p-3 rounded-lg text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#212529] text-white py-3 rounded-xl font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            {loading ? "Уншиж байна..." : "Нэвтрэх"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E9ECEF]" />
          <span className="text-xs text-[#ADB5BD]">Эсвэл</span>
          <div className="h-px flex-1 bg-[#E9ECEF]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full rounded-xl border border-[#DEE2E6] bg-white py-3 font-medium text-[#212529] transition-colors hover:bg-[#F8F9FA] disabled:opacity-50"
        >
          Google-ээр нэвтрэх
        </button>

        <div className="mt-8 pt-6 border-t border-[#F1F3F5] text-center">
          <p className="text-[#ADB5BD] text-xs">
            © 2026 Vault OS. Бүх эрх хуулиар хамгаалагдсан.
          </p>
        </div>
      </div>
    </div>
  );
}
