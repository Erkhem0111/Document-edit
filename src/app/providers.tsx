"use client";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  // 5 минут тутам (мөн цонх руу буцаж ороход) session-ийг шинэчилнэ —
  // admin эрх өөрчлөгдвөл цэс дахин нэвтрэхгүйгээр шинэчлэгдэнэ.
  return (
    <SessionProvider refetchInterval={5 * 60}>
      {children}
      {/* Бүх toast мэдэгдэл (амжилттай / алдаа) энд харагдана */}
      <Toaster position="bottom-right" richColors closeButton duration={5000} />
    </SessionProvider>
  );
}
