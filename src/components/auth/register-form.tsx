"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fields = [
  { key: "nickname", label: "Нэр", type: "text", placeholder: "Мэргэжилтэн Бат", autoComplete: "nickname" },
  { key: "email", label: "И-мэйл хаяг", type: "email", placeholder: "name@company.com", autoComplete: "email" },
  { key: "phoneNumber", label: "Утасны дугаар", type: "tel", placeholder: "+97699112233", autoComplete: "tel" },
  { key: "password", label: "Нууц үг", type: "password", placeholder: "8+ тэмдэгт", autoComplete: "new-password" },
] as const;

type FieldKey = (typeof fields)[number]["key"];

export function RegisterForm() {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    email: "",
    nickname: "",
    phoneNumber: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) router.push("/login");
      else setError((await res.json()).message || "Бүртгэл амжилтгүй боллоо.");
    } catch {
      setError("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((field) => (
        <label key={field.key} className="block text-sm font-medium text-[#101b22]">
          <span className="mb-2 block">{field.label}</span>
          <Input
            type={field.type}
            value={values[field.key]}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            className="h-11 rounded-[8px] border-[#d8c58f] bg-[#fbfaf7]"
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            required
          />
        </label>
      ))}
      {error && (
        <p className="rounded-[8px] bg-destructive/10 p-3 text-center text-xs text-destructive">
          {error}
        </p>
      )}
      <Button className="h-11 w-full bg-[#101b22] hover:bg-[#1a2b35]" disabled={loading}>
        {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
      </Button>
      <p className="text-center text-sm text-[#64737b]">
        Бүртгэлтэй юу?{" "}
        <Link href="/login" className="font-semibold text-[#101b22] hover:underline">
          Нэвтрэх
        </Link>
      </p>
    </form>
  );
}
