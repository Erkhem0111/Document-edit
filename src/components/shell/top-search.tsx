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

const MIN_QUERY = 2; // 1 тэмдэгтээр хайх нь хэт олон үр дүн, хэрэггүй ачаалал

type SearchStatus = "idle" | "loading" | "done" | "error";

export function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  // Одоо харагдаж буй үр дүн аль хайлтынх вэ — шинэ хайлтын хариу ирэхээс
  // өмнө Enter дарж хуучин үр дүн рүү андуурч орохоос сэргийлнэ
  const [resultsFor, setResultsFor] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (timer.current) clearTimeout(timer.current);
      inflight.current?.abort();
    };
  }, []);

  function onChange(value: string) {
    setQ(value);
    setOpen(true);
    setHighlight(0);
    if (timer.current) clearTimeout(timer.current);
    // Өмнөх хүсэлт хэрэггүй болсон — серверт дахин ачаалал өгөхгүй цуцална
    inflight.current?.abort();
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setResultsFor("");
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      inflight.current = controller;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results?: Result[] };
        setResults(data.results ?? []);
        setResultsFor(trimmed);
        setStatus("done");
      } catch (err) {
        if (controller.signal.aborted) return; // шинэ хайлт эхэлсэн — үүнийг үл тооно
        console.error("Search failed:", err);
        setStatus("error");
      }
    }, 250);
  }

  function go(result: Result) {
    setOpen(false);
    setQ("");
    setResults([]);
    setResultsFor("");
    setStatus("idle");
    router.push(`/dashboard/file?folderId=${result.projectId}&fileId=${result.id}`);
  }

  const trimmed = q.trim();
  const fresh = status === "done" && resultsFor === trimmed;
  const loading = status === "loading";

  return (
    <div ref={boxRef} className="relative w-full max-w-2xl" data-tour="search">
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
              setHighlight((h) => Math.max(0, Math.min(h + 1, results.length - 1)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            }
            // Зөвхөн одоогийн бичсэн үгийн үр дүн рүү л орно
            if (e.key === "Enter" && fresh && results[highlight]) go(results[highlight]);
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

      {open && trimmed && (
        <div className="absolute inset-x-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-card">
          {trimmed.length < MIN_QUERY ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Дор хаяж {MIN_QUERY} тэмдэгт бичнэ үү.</p>
          ) : status === "error" ? (
            <p role="alert" className="px-4 py-3 text-sm text-destructive">
              Хайж чадсангүй. Интернэтээ шалгаад дахин бичнэ үү.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {loading ? "Хайж байна…" : `“${trimmed}” олдсонгүй.`}
            </p>
          ) : (
            // Шинэ хариу иртэл өмнөх үр дүнг бүдэг харуулна (анивчихгүй)
            <div className={loading ? "opacity-60" : undefined}>
              {results.map((r, i) => (
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
