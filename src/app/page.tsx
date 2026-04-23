// src/app/page.tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-16 h-16 bg-black rounded-2xl mb-6 flex items-center justify-center">
        <span className="text-white font-bold text-2xl">V</span>
      </div>
      <h1 className="text-4xl font-bold text-[#212529] mb-4">Vault OS</h1>
      <p className="text-[#6C757D] text-lg mb-8 text-center max-w-md">
        Мэргэжлийн баримт бичиг хяналт болон удирдлагын систем
      </p>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-8 py-3 bg-[#212529] text-white rounded-xl font-medium hover:bg-black transition-all shadow-sm"
        >
          Нэвтрэх
        </Link>
        <Link
          href="/register"
          className="px-8 py-3 bg-white text-[#212529] border border-[#DEE2E6] rounded-xl font-medium hover:bg-[#F1F3F5] transition-all"
        >
          Бүртгүүлэх
        </Link>
      </div>
    </div>
  );
}
