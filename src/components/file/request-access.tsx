"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";

// Холбоосоор орж ирээд эрхгүй байвал — төслийн эзэнд хүсэлт илгээнэ.
// Эзэн мэдэгдлээс нэг дарахад таныг нэмэх цонх нээгдэнэ.
export function RequestAccessButton({ projectId, fileId }: { projectId?: string; fileId?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  async function send() {
    setState("busy");
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fileId ? { fileId } : { projectId }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.status === 409) {
        toast.success(data?.message ?? "Танд аль хэдийн эрх байна.");
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(data?.message);
      setState("sent");
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error && err.message ? err.message : "Хүсэлт илгээж чадсангүй. Дахин оролдоно уу.");
    }
  }

  if (state === "sent") {
    return (
      <p className="mt-4 inline-flex items-start gap-2 text-left text-sm text-teal">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        Хүсэлт илгээгдлээ. Эзэн нь таныг нэмэхэд мэдэгдэл очно.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void send()}
      disabled={state === "busy"}
      className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
    >
      {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
      Хандах эрх хүсэх
    </button>
  );
}
