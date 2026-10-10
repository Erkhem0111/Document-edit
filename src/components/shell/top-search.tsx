"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { FileTypeIcon } from "@/components/file/file-type-icon";

// ─── Дээд талын хайлт (Drive шиг өргөн талбар) ────────────────────────────────
// Бичих бүрт биш — 250ms зогссоны дараа хайна. ↑/↓ + Enter-ээр сонгоно.

type Result = {
  id: string;
  name: string;
  mimeType: string;
  projectId: string;
  project: { name: string };
};

export function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onChange(value: string) {
    setQ(value);
    setOpen(true);
    setHighlight(0);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await res.json().catch(() => null)) as { results?: Result[] } | null;
        setResults(res.ok ? (data?.results ?? []) : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function go(result: Result) {
    setOpen(false);
    setQ("");
    setResults([]);
    router.push(`/dashboard/file?folderId=${result.projectId}&fileId=${result.id}`);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-2xl">
      <div className="flex items-center gap-2.5 rounded-full bg-muted px-4 py-2 transition focus-within:bg-card focus-within:shadow-soft focus-within:ring-1 focus-within:ring-border">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => q.trim() && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            }
            if (e.key === "Enter" && results[highlight]) go(results[highlight]);
          }}
          placeholder="Файлаас хайх"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button
            type="button"
            title="Цэвэрлэх"
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && q.trim() && !loading && (
        <div className="absolute inset-x-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-card">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">“{q.trim()}” олдсонгүй.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  i === highlight ? "bg-accent" : ""
                }`}
              >
                <FileTypeIcon name={r.name} mimeType={r.mimeType} size="sm" />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="max-w-48 shrink-0 truncate text-xs text-muted-foreground">
                  {r.project.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
