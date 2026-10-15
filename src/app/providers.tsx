"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // 5 минут тутам (мөн цонх руу буцаж ороход) session-ийг шинэчилнэ —
  // admin эрх өөрчлөгдвөл цэс дахин нэвтрэхгүйгээр шинэчлэгдэнэ.
  return <SessionProvider refetchInterval={5 * 60}>{children}</SessionProvider>;
}
