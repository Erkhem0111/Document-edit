"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

// Арын шинэчлэлт амжилтгүй болсон ч өмнө ачаалсан өгөгдөл байгаа үед —
// хуудсыг хоослохгүй, дээр нь анхааруулга, "Дахин оролдох" товч харуулна.
export function StaleBanner({ message, onRetry }: { message: string; onRetry: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
    >
      <span className="min-w-0 flex-1">Сүүлийн өөрчлөлтийг ачаалж чадсангүй: {message}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRetry();
          } finally {
            setBusy(false);
          }
        }}
        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-amber-100 disabled:opacity-60"
      >
        <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Дахин оролдох
      </button>
    </div>
  );
}
