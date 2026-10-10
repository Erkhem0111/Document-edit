"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Download, FileUp, Info, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fixSwapped,
  parseCoordinates,
  polygonArea,
  segmentLengths,
  toCsv,
  toDxf,
  toKml,
  utmToLatLon,
  type CoordPoint,
  type ParsedCoordinates,
} from "@/lib/coordinates";

// ─── Координат харагч ─────────────────────────────────────────────────────────
// Файлыг (компьютерээс эсвэл төслөөс ?fileId=) уншиж цэгүүдийг зурна,
// талбай/периметр тооцоолж, X/Y солигдсон, хэт хол цэгийг анхааруулна.
// Бүх тооцоо browser дотор — файл хаашаа ч илгээгдэхгүй.

const ZONES = [46, 47, 48, 49, 50];

export default function CoordinatesPage() {
  return (
    <Suspense fallback={null}>
      <CoordinatesView />
    </Suspense>
  );
}

function CoordinatesView() {
  const searchParams = useSearchParams();
  const fileId = searchParams.get("fileId");
  const [title, setTitle] = useState("");
  const [data, setData] = useState<ParsedCoordinates | null>(null);
  const [points, setPoints] = useState<CoordPoint[]>([]);
  const [zone, setZone] = useState(48);
  const [closed, setClosed] = useState(true);
  const [labels, setLabels] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function load(name: string, text: string) {
    const parsed = parseCoordinates(text);
    if (parsed.points.length === 0) {
      toast.error("Энэ файлаас координат олдсонгүй.");
      return;
    }
    setTitle(name);
    setData(parsed);
    setPoints(parsed.points);
    setSelected(null);
    if (parsed.zone) setZone(parsed.zone);
  }

  // Төслийн файлаас нээх
  useEffect(() => {
    if (!fileId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/files/${fileId}/text`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { name?: string; text?: string; message?: string } | null;
        if (!res.ok || !body?.text) throw new Error(body?.message ?? "Файлыг уншиж чадсангүй.");
        if (alive) load(body.name ?? "Файл", body.text);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Файлыг уншиж чадсангүй."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fileId]);

  async function openLocal(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл хэт том байна (5MB хүртэл).");
      return;
    }
    const buffer = await file.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder("windows-1251").decode(buffer);
    }
    load(file.name, text);
  }

  const stats = useMemo(() => {
    const usable = points.filter((p) => !p.swapped);
    const segs = segmentLengths(usable, closed);
    return {
      area: closed ? polygonArea(usable) : 0,
      length: segs.reduce((a, b) => a + b, 0),
      segs,
    };
  }, [points, closed]);

  const swappedCount = points.filter((p) => p.swapped).length;
  const outliers = points.filter((p) => p.outlier);
  const local = data?.local ?? false;

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const base = title.replace(/\.[^.]+$/, "") || "coordinates";

  return (
    <div className="px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-1.5 font-sans text-lg md:text-xl">
          <Link href="/dashboard/tools" className="text-muted-foreground hover:text-foreground">
            Хэрэгслүүд
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          Координат харагч
        </h1>
        {title && <span className="truncate text-xs text-muted-foreground">{title}</span>}
        <div className="ml-auto">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.xyz,.pts,.dat,.asc"
            className="hidden"
            onChange={(e) => {
              void openLocal(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1.5 h-4 w-4" /> Файл нээх
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-32 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Уншиж байна…
        </div>
      ) : !data ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void openLocal(e.dataTransfer.files?.[0]);
          }}
          className="mt-5 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-6 py-20 text-center"
        >
          <MapPin className="h-8 w-8 text-teal" />
          <span className="text-sm text-foreground">Координатын файлаа энд чирж тавь, эсвэл дарж сонго</span>
          <span className="max-w-md text-xs text-muted-foreground">
            CSV, TXT (таслал, цэг таслал, таб, зай). Багануудыг өөрөө таниад X (хойд), Y (зүүн)-ийг
            ялгана. Файл хаашаа ч илгээгдэхгүй — зөвхөн таны компьютер дээр.
          </span>
          <span className="mt-2 text-xs text-muted-foreground">
            Төслийн CSV/TXT файлын хажуугийн 📍 товчоор ч шууд нээгдэнэ.
          </span>
        </button>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-3">
            <Plot points={points} closed={closed} labels={labels} selected={selected} onSelect={setSelected} />
            <PointsTable points={points} segs={stats.segs} closed={closed} selected={selected} onSelect={setSelected} />
          </div>

          <aside className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Цэг" value={String(points.length)} />
              <Stat label={closed ? "Периметр" : "Урт"} value={`${stats.length.toFixed(2)} м`} />
              {closed && (
                <>
                  <Stat label="Талбай" value={`${stats.area.toFixed(2)} м²`} />
                  <Stat label="Га" value={(stats.area / 10000).toFixed(4)} />
                </>
              )}
            </div>

            {swappedCount > 0 && (
              <Warn tone="red">
                <b>{swappedCount} цэгийн X/Y солигдсон байж болзошгүй</b> (
                {points
                  .filter((p) => p.swapped)
                  .map((p) => p.name)
                  .slice(0, 6)
                  .join(", ")}
                ). Тооцоонд оруулаагүй.
                <Button
                  size="sm"
                  className="mt-2 h-7 w-full bg-red-700 text-white hover:bg-red-800"
                  onClick={() => setPoints((ps) => fixSwapped(ps))}
                >
                  Солиод засах
                </Button>
              </Warn>
            )}
            {outliers.length > 0 && (
              <Warn tone="amber">
                <b>{outliers.map((p) => p.name).slice(0, 6).join(", ")}</b> цэг бусдаасаа хэт хол байна —
                бичлэгийн алдаа эсэхийг шалгаарай.
              </Warn>
            )}
            {data.skipped > 0 && (
              <Warn tone="amber">{data.skipped} мөрийг уншиж чадсангүй (тоо биш эсвэл дутуу).</Warn>
            )}

            <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-xs">
              <div className="text-muted-foreground">{data.columns}</div>
              {local ? (
                <div className="flex gap-1.5 text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  UTM биш (орон нутгийн/нөхцөлт систем) гэж үзлээ — хавтгай тооцоо хийнэ, KML гаргахгүй.
                </div>
              ) : (
                <label className="flex items-center gap-2">
                  UTM бүс
                  <select
                    value={zone}
                    onChange={(e) => setZone(Number(e.target.value))}
                    className="h-7 rounded-md border border-border bg-background px-2"
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">{data.zone ? "(файлаас)" : "(Улаанбаатар — 48)"}</span>
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />
                Хил болгож хаах (талбай тооцох)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
                Цэгийн нэр харуулах
              </label>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Татах</div>
              <div className="flex flex-wrap gap-2">
                {!local && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      download(`${base}.kml`, toKml(points.filter((p) => !p.swapped), zone, base, closed), "application/vnd.google-earth.kml+xml")
                    }
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> KML
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => download(`${base}.dxf`, toDxf(points.filter((p) => !p.swapped), closed), "application/dxf")}>
                  <Download className="mr-1 h-3.5 w-3.5" /> DXF
                </Button>
                <Button size="sm" variant="outline" onClick={() => download(`${base}-засварласан.csv`, "﻿" + toCsv(points), "text/csv")}>
                  <Download className="mr-1 h-3.5 w-3.5" /> CSV
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                KML — Google Earth. DXF — AutoCAD/Civil 3D. CSV — засварласан хувилбар.
              </p>
            </div>

            {selected != null && points[selected] && !local && (
              <div className="rounded-xl border border-border bg-card p-3 text-xs">
                <div className="font-medium">{points[selected].name}</div>
                <LatLon p={points[selected]} zone={zone} />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function LatLon({ p, zone }: { p: CoordPoint; zone: number }) {
  const ll = utmToLatLon(p.swapped ? p.y : p.x, p.swapped ? p.x : p.y, zone);
  return (
    <div className="mt-1 text-muted-foreground">
      WGS84: {ll.lat.toFixed(6)}°, {ll.lon.toFixed(6)}°
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Warn({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  return (
    <div
      className={`flex gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
        tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ─── Зураг (SVG) — хойд нь дээшээ, масштабын шугамтай ───────────────────────
function Plot({
  points,
  closed,
  labels,
  selected,
  onSelect,
}: {
  points: CoordPoint[];
  closed: boolean;
  labels: boolean;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const W = 800;
  const H = 520;
  const pad = 40;
  // Солигдсон, хэт хол цэгүүд масштабыг эвдэхгүйн тулд хүрээг бусдаар тогтооно
  const core = points.filter((p) => !p.swapped && !p.outlier);
  const frame = core.length >= 2 ? core : points.filter((p) => !p.swapped);
  const minE = Math.min(...frame.map((p) => p.y));
  const maxE = Math.max(...frame.map((p) => p.y));
  const minN = Math.min(...frame.map((p) => p.x));
  const maxN = Math.max(...frame.map((p) => p.x));
  const span = Math.max(maxE - minE, maxN - minN, 1);
  const scale = Math.min((W - pad * 2) / Math.max(maxE - minE, span * 0.2), (H - pad * 2) / Math.max(maxN - minN, span * 0.2));
  const cx = (minE + maxE) / 2;
  const cy = (minN + maxN) / 2;
  const sx = (e: number) => W / 2 + (e - cx) * scale;
  const sy = (n: number) => H / 2 - (n - cy) * scale;
  const usable = points.map((p, i) => ({ p, i })).filter(({ p }) => !p.swapped);
  const path = usable.map(({ p }, k) => `${k ? "L" : "M"}${sx(p.y).toFixed(1)},${sy(p.x).toFixed(1)}`).join(" ");

  // Масштабын шугам: 1/2/5×10ⁿ м
  const target = (W * 0.2) / scale;
  const pow = 10 ** Math.floor(Math.log10(target));
  const nice = [1, 2, 5].map((k) => k * pow).filter((v) => v <= target).pop() ?? pow;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#fbfaf6]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Цэгүүдийн зураг">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#ece6da" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {usable.length > 1 && (
          <path
            d={path + (closed ? " Z" : "")}
            fill={closed ? "rgba(15,118,110,0.10)" : "none"}
            stroke="#0f766e"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => {
          const e = p.swapped ? p.x : p.y; // солигдсоныг зөв байранд нь тасархай тойргоор
          const n = p.swapped ? p.y : p.x;
          const color = p.swapped ? "#b91c1c" : p.outlier ? "#b45309" : "#0f766e";
          const x = Math.min(W - 8, Math.max(8, sx(e)));
          const y = Math.min(H - 8, Math.max(8, sy(n)));
          return (
            <g key={i} onClick={() => onSelect(i)} className="cursor-pointer">
              <circle
                cx={x}
                cy={y}
                r={selected === i ? 7 : 4.5}
                fill={p.swapped || p.outlier ? "#fff" : color}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={p.swapped ? "3 2" : undefined}
              />
              {labels && (
                <text x={x + 7} y={y - 7} fontSize="12" fill={color} fontFamily="Inter, Arial">
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
        {/* Хойд зүг */}
        <g transform={`translate(${W - 34},34)`}>
          <path d="M0,-16 L7,8 L0,3 L-7,8 Z" fill="#1f2328" />
          <text y="24" textAnchor="middle" fontSize="11" fill="#1f2328">
            Х
          </text>
        </g>
        <g transform={`translate(20,${H - 20})`}>
          <rect width={nice * scale} height="5" fill="#1f2328" />
          <text y="-6" fontSize="11" fill="#1f2328">
            {nice >= 1000 ? `${nice / 1000} км` : `${nice} м`}
          </text>
        </g>
      </svg>
    </div>
  );
}

function PointsTable({
  points,
  segs,
  closed,
  selected,
  onSelect,
}: {
  points: CoordPoint[];
  segs: number[];
  closed: boolean;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  let k = 0; // segs нь зөвхөн солигдоогүй цэгүүдийнх
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-border bg-card text-xs">
      <table className="w-full tabular-nums">
        <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-normal">Нэр</th>
            <th className="px-3 py-2 text-right font-normal">X (хойд)</th>
            <th className="px-3 py-2 text-right font-normal">Y (зүүн)</th>
            <th className="px-3 py-2 text-right font-normal">H</th>
            <th className="px-3 py-2 text-right font-normal">{closed ? "Дараагийн цэг хүртэл" : "Дараагийн хүртэл"}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => {
            const seg = p.swapped ? null : segs[k++];
            return (
              <tr
                key={i}
                onClick={() => onSelect(i)}
                className={`cursor-pointer border-b border-border/50 last:border-0 ${
                  selected === i ? "bg-accent" : p.swapped ? "bg-red-50" : p.outlier ? "bg-amber-50" : "hover:bg-accent/50"
                }`}
              >
                <td className="px-3 py-1.5">
                  {p.name}
                  {p.code && <span className="ml-1.5 text-muted-foreground">{p.code}</span>}
                  {p.swapped && <span className="ml-1.5 text-red-700">X/Y?</span>}
                  {p.outlier && <span className="ml-1.5 text-amber-700">хол</span>}
                </td>
                <td className="px-3 py-1.5 text-right">{p.x.toFixed(3)}</td>
                <td className="px-3 py-1.5 text-right">{p.y.toFixed(3)}</td>
                <td className="px-3 py-1.5 text-right">{p.z != null ? p.z.toFixed(3) : "—"}</td>
                <td className="px-3 py-1.5 text-right">{seg != null ? `${seg.toFixed(2)} м` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
