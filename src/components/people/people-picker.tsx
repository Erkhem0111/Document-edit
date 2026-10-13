"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Хүн сонгогч (Google Docs маягийн) ────────────────────────────────────────
// Нэр/имэйлээ бичихэд компанийн хэрэглэгчдээс санал болгоно. Олон хүн сонгож
// болно (chip). Урих код, имэйл гараар бичих шаардлагагүй.

export type DirectoryUser = {
  id: string;
  email: string;
  nickname?: string | null;
  avatarUrl?: string | null;
};

let directoryCache: Promise<DirectoryUser[]> | null = null;
function loadDirectory() {
  directoryCache ??= fetch("/api/users/directory")
    .then((r) => (r.ok ? r.json() : { users: [] }))
    .then((d: { users?: DirectoryUser[] }) => d.users ?? [])
    .catch(() => {
      directoryCache = null;
      return [];
    });
  return directoryCache;
}

const COLORS = ["#0f766e", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#15803d", "#0e7490"];
export function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function PersonAvatar({ user, size = 28 }: { user: { email?: string; nickname?: string | null }; size?: number }) {
  const name = user.nickname || user.email || "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: avatarColor(user.email ?? name) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function PeoplePicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = "Нэр эсвэл имэйлээр хайх",
  autoFocus,
}: {
  value: DirectoryUser[];
  onChange: (next: DirectoryUser[]) => void;
  excludeIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void loadDirectory().then((users) => alive && setDirectory(users));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const taken = useMemo(() => new Set([...excludeIds, ...value.map((u) => u.id)]), [excludeIds, value]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory
      .filter((u) => !taken.has(u.id))
      .filter((u) => !q || u.email.toLowerCase().includes(q) || (u.nickname ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [directory, query, taken]);

  function pick(user: DirectoryUser) {
    onChange([...value, user]);
    setQuery("");
    setOpen(false);
    setHighlight(0);
    inputRef.current?.focus();
  }

  return (
    <div ref={boxRef} className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40"
      >
        {value.map((u) => (
          <span key={u.id} className="flex items-center gap-1 rounded-full bg-accent py-0.5 pl-0.5 pr-1.5 text-xs">
            <PersonAvatar user={u} size={20} />
            <span className="max-w-40 truncate">{u.nickname || u.email}</span>
            <button
              type="button"
              aria-label="Хасах"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v.id !== u.id));
              }}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && open && suggestions[highlight]) {
              e.preventDefault();
              pick(suggestions[highlight]);
            } else if (e.key === "Backspace" && !query && value.length > 0) {
              onChange(value.slice(0, -1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {/* Бичиж байх үед л санал харуулна — сонгосны дараа доорх товчийг хаахгүй */}
      {open && query.trim() !== "" && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-card">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
              Олдсонгүй. Зөвхөн системд бүртгэлтэй (админ зөвшөөрсөн) хүнийг нэмнэ.
            </div>
          ) : (
            suggestions.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                  i === highlight ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <PersonAvatar user={u} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{u.nickname || u.email}</span>
                  {u.nickname && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
