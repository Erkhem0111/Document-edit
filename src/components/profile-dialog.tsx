"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, UserRound, Sparkles } from "lucide-react";
import { startTour } from "@/components/tour/tour-launcher";

// Өөрийн профайл засах — одоогоор nickname.
// Хадгалсны дараа session-ээ update() хийж шинэ нэрийг шууд ашиглана.
export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { update } = useSession();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch("/api/me");
        const data = (await res.json().catch(() => null)) as
          | { user?: { nickname?: string | null; email?: string } }
          | null;
        if (res.ok && data?.user) {
          setNickname(data.user.nickname ?? "");
          setEmail(data.user.email ?? "");
        }
      } finally {
        setLoading(false);
      }
    }

    queueMicrotask(() => {
      void loadProfile();
    });
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!res.ok) throw new Error(data?.message ?? "Хадгалж чадсангүй.");
      // JWT доторх нэрийг шинэчилнэ (jwt callback trigger="update" дээр DB-ээс дахин уншина)
      // update({}) — өгөгдөлгүй update() нь зөвхөн GET хийдэг тул jwt callback
      // "update" trigger авахгүй, шинэ нэр харагдахгүй байв. Хоосон объект нь POST.
      await update({});
      toast.success("Профайл хадгалагдлаа");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            <UserRound className="mr-2 inline size-5" />
            Профайл
          </DialogTitle>
        </DialogHeader>

        <div>
          <Label>Имэйл</Label>
          <Input value={email} disabled className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="profile-nickname">Нэр (nickname)</Label>
          <Input
            id="profile-nickname"
            value={nickname}
            disabled={loading}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            placeholder="Жишээ: Эрхэм"
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Comment, гишүүдийн жагсаалтад энэ нэр харагдана. Хоосон бол имэйл
            харагдана.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            // Цонх хаагдаж дуусахыг хүлээгээд эхлүүлнэ
            setTimeout(() => startTour("home"), 200);
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent"
        >
          <Sparkles className="size-4 shrink-0 text-teal" />
          <span>
            Танилцуулгыг дахин үзэх
            <span className="block text-xs text-muted-foreground">Гол хэсгүүдийг алхам алхмаар үзүүлнэ</span>
          </span>
        </button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={saving || loading}
            onClick={save}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Хадгалах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
