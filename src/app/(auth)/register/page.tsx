"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
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
        body: JSON.stringify({ email, nickname, password }),
      });

      if (res.ok) {
        router.push("/login"); // Бүртгүүлсний дараа Login руу шилжүүлнэ
      } else {
        const data = await res.json();
        setError(data.message || "Бүртгэл амжилтгүй боллоо.");
      }
    } catch (err) {
      setError("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="w-full max-w-md p-8 bg-white rounded-[24px] shadow-sm border border-[#E9ECEF]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-black rounded-xl mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-[#212529]">Vault OS</h1>
          <p className="text-[#6C757D] text-sm mt-2">Шинэ бүртгэл үүсгэх</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#495057] mb-2">
              Нэр (Nickname)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#DEE2E6] focus:outline-none focus:ring-2 focus:ring-black/5"
              placeholder="Мэргэжилтэн Бат"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#495057] mb-2">
              И-мэйл хаяг
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#DEE2E6] focus:outline-none focus:ring-2 focus:ring-black/5"
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
              className="w-full px-4 py-3 rounded-xl border border-[#DEE2E6] focus:outline-none focus:ring-2 focus:ring-black/5"
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
            {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6C757D]">
          Бүртгэлтэй юу?{" "}
          <Link
            href="/login"
            className="text-black font-semibold hover:underline"
          >
            Нэвтрэх
          </Link>
        </p>
      </div>
    </div>
  );
}
