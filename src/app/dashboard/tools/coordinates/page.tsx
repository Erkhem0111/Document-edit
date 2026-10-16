"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { uploadProjectFile } from "@/lib/upload-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Download, FileText, FileUp, Info, Loader2, MapPin, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifyProjectsChanged } from "@/hooks/use-project-folders";
import {
  buildCatalog,
  findSelfIntersections,
  fixSwapped,
  formatDms,
  parseCoordinates,
  polygonArea,
  toCsv,
  toDxf,
  toKml,
  utmToLatLon,
  type CatalogRow,
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
  // Хэт хол цэгийг анхдагчаар тооцоонд оруулахгүй (бичлэгийн алдаа байх магадлалтай)
  const [includeOutliers, setIncludeOutliers] = useState(false);
  // Төслөөс нээсэн бол каталогийг тэр хавтсанд нь хадгална
  const [source, setSource] = useState<{ projectId: string; folderId: string | null } | null>(null);
  const [official, setOfficial] = useState("");
  const [officialUnit, setOfficialUnit] = useState<"m2" | "ha">("m2");
  const [view, setView] = useState<"points" | "catalog">("points");
  // UTM файлд хиймэл дагуулын зургийг анхдагчаар харуулна
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [saving, setSaving] = useState(false);
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
    setIncludeOutliers(false);
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
        const body = (await res.json().catch(() => null)) as {
          name?: string;
          text?: string;
          message?: string;
          projectId?: string;
          folderId?: string | null;
        } | null;
        if (!res.ok || !body?.text) throw new Error(body?.message ?? "Файлыг уншиж чадсангүй.");
        if (!alive) return;
        load(body.name ?? "Файл", body.text);
        if (body.projectId) setSource({ projectId: body.projectId, folderId: body.folderId ?? null });
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
    setSource(null);
    load(file.name, text);
  }

  // Тооцоонд орох цэгүүд: X/Y солигдсон, (сонголтоор) хэт хол цэгийг хасна
  const included = useMemo(
    () => points.filter((p) => !p.swapped && (includeOutliers || !p.outlier)),
    [points, includeOutliers],
  );
  const stats = useMemo(() => {
    const rows = buildCatalog(included, closed);
    return {
      area: closed ? polygonArea(included) : 0,
      length: rows.reduce((a, r) => a + r.length, 0),
      rows,
      crossings: findSelfIntersections(included, closed),
    };
  }, [included, closed]);

  const swappedCount = points.filter((p) => p.swapped).length;
  const outliers = points.filter((p) => p.outlier);
  const local = data?.local ?? false;

  // Гэрчилгээний талбайтай харьцуулах
  const officialM2 = (Number(official.replace(",", ".")) || 0) * (officialUnit === "ha" ? 10000 : 1);
  const comparison =
    closed && officialM2 > 0
      ? { area: officialM2, diff: stats.area - officialM2, percent: ((stats.area - officialM2) / officialM2) * 100 }
      : null;

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
  const system = local ? "Орон нутгийн (нөхцөлт) систем" : `UTM, ${zone}-р бүс (MONREF97)`;

  async function catalogBlob() {
    const { buildCatalogDocx } = await import("@/lib/coordinate-catalog-docx");
    return buildCatalogDocx({
      title: "Хилийн цэгийн координатын жагсаалт",
      sourceName: title,
      system,
      points: included,
      rows: stats.rows,
      closed,
      area: stats.area,
      length: stats.length,
      official: comparison,
    });
  }

  async function downloadCatalog() {
    try {
      const blob = await catalogBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base} — каталог.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Word файл үүсгэж чадсангүй.");
    }
  }

  // Каталогийг эх файлын хажууд (ижил хавтсанд) Word файл болгон хадгална
  async function saveCatalogToProject() {
    if (!source) return;
    setSaving(true);
    try {
      const blob = await catalogBlob();
      await uploadProjectFile(
        source.projectId,
        new File([blob], `${base} — каталог.docx`, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        source.folderId,
      );
      toast.success("Каталог төсөлд хадгалагдлаа");
      notifyProjectsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  }

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
            {!local && basemap !== "none" ? (
              <MapPlot
                points={points}
                included={included}
                closed={closed}
                labels={labels}
                selected={selected}
                onSelect={setSelected}
                zone={zone}
                basemap={basemap}
              />
            ) : (
              <Plot
                points={points}
                included={included}
                closed={closed}
                labels={labels}
                selected={selected}
                onSelect={setSelected}
              />
            )}
            <div className="flex items-center gap-2">
              <div className="flex rounded-full bg-muted p-0.5 text-xs">
                {(
                  [
                    ["points", "Цэгүүд"],
                    ["catalog", "Каталог (урт, өнцөг)"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view === "catalog" && (
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => void downloadCatalog()}>
                    <FileText className="mr-1 h-3.5 w-3.5" /> Word татах
                  </Button>
                  {source && (
                    <Button
                      size="sm"
                      className="h-8 bg-primary text-primary-foreground"
                      disabled={saving}
                      onClick={() => void saveCatalogToProject()}
                    >
                      {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                      Төсөлд хадгалах
                    </Button>
                  )}
                </div>
              )}
            </div>
            {view === "points" ? (
              <PointsTable
                points={points}
                rows={stats.rows}
                closed={closed}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <CatalogTable rows={stats.rows} points={included} closed={closed} />
            )}
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

            {closed && (
              <div className="rounded-xl border border-border bg-card p-3 text-xs">
                <label htmlFor="official-area" className="text-muted-foreground">
                  Гэрчилгээ / захиалгын талбайтай харьцуулах
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="official-area"
                    inputMode="decimal"
                    value={official}
                    onChange={(e) => setOfficial(e.target.value)}
                    placeholder="Жишээ: 3650"
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 tabular-nums"
                  />
                  <select
                    value={officialUnit}
                    onChange={(e) => setOfficialUnit(e.target.value as "m2" | "ha")}
                    className="h-8 rounded-md border border-border bg-background px-2"
                  >
                    <option value="m2">м²</option>
                    <option value="ha">га</option>
                  </select>
                </div>
                {comparison && (
                  <div className="mt-2 tabular-nums">
                    Зөрүү:{" "}
                    <b className={Math.abs(comparison.percent) >= 1 ? "text-amber-700" : "text-foreground"}>
                      {comparison.diff >= 0 ? "+" : ""}
                      {comparison.diff.toFixed(2)} м² ({comparison.percent >= 0 ? "+" : ""}
                      {comparison.percent.toFixed(2)}%)
                    </b>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Координатаар бодсон {stats.area.toFixed(2)} м² − баримт дээрх {comparison.area.toFixed(2)} м²
                    </div>
                  </div>
                )}
              </div>
            )}

            {stats.crossings.length > 0 && (
              <Warn tone="red">
                <b>Хил өөрийгөө огтолж байна</b> (
                {stats.crossings
                  .map(([i, j]) => {
                    const a = stats.rows[i];
                    const b = stats.rows[j];
                    return a && b ? `${a.from.name}–${a.to.name} ба ${b.from.name}–${b.to.name}` : "";
                  })
                  .filter(Boolean)
                  .join("; ")}
                ). Цэгийн дараалал алдагдсан байж болзошгүй — талбай буруу гарна.
              </Warn>
            )}
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
                бичлэгийн алдаа эсэхийг шалгаарай.{" "}
                {includeOutliers ? "Одоо тооцоонд орсон." : "Тооцоонд оруулаагүй."}
                <button
                  type="button"
                  onClick={() => setIncludeOutliers((v) => !v)}
                  className="mt-2 block font-medium underline underline-offset-2"
                >
                  {includeOutliers ? "Тооцооноос хасах" : "Тооцоонд оруулах"}
                </button>
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
              {!local && (
                <div className="space-y-1">
                  <div>Суурь зураг</div>
                  <div className="flex w-fit whitespace-nowrap rounded-full bg-muted p-0.5">
                    {(
                      [
                        ["satellite", "Хиймэл дагуул"],
                        ["street", "Гудамж"],
                        ["none", "Байхгүй"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBasemap(value)}
                        className={`rounded-full px-2.5 py-0.5 transition-colors ${
                          basemap === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
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
                      download(`${base}.kml`, toKml(included, zone, base, closed), "application/vnd.google-earth.kml+xml")
                    }
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> KML
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => download(`${base}.dxf`, toDxf(included, closed), "application/dxf")}>
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
  included,
  closed,
  labels,
  selected,
  onSelect,
}: {
  points: CoordPoint[];
  included: CoordPoint[];
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
  const inSet = new Set(included);
  const path = included.map((p, k) => `${k ? "L" : "M"}${sx(p.y).toFixed(1)},${sy(p.x).toFixed(1)}`).join(" ");

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
        {included.length > 1 && (
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
                fill={inSet.has(p) ? color : "#fff"}
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
  rows,
  closed,
  selected,
  onSelect,
}: {
  points: CoordPoint[];
  rows: CatalogRow[];
  closed: boolean;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  // Тал бүр эхлэх цэгээрээ (тооцоонд ороогүй цэгт тал байхгүй)
  const byFrom = new Map(rows.map((r) => [r.from, r]));
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
            const seg = byFrom.get(p)?.length ?? null;
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

// ─── Каталог: цэг + тэр цэгээс дараагийн цэг хүртэлх тал (урт, дирекцийн өнцөг) ─
function CatalogTable({ rows, points, closed }: { rows: CatalogRow[]; points: CoordPoint[]; closed: boolean }) {
  const byFrom = new Map(rows.map((r) => [r.from, r]));
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-border bg-card text-xs">
      <table className="w-full tabular-nums">
        <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-center font-normal">№</th>
            <th className="px-3 py-2 text-left font-normal">Цэг</th>
            <th className="px-3 py-2 text-right font-normal">X, м</th>
            <th className="px-3 py-2 text-right font-normal">Y, м</th>
            <th className="px-3 py-2 text-center font-normal">Тал</th>
            <th className="px-3 py-2 text-right font-normal">Урт, м</th>
            <th className="px-3 py-2 text-right font-normal">Дирекцийн өнцөг</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => {
            const r = byFrom.get(p);
            return (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-3 py-1.5 text-center text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5">{p.name}</td>
                <td className="px-3 py-1.5 text-right">{p.x.toFixed(3)}</td>
                <td className="px-3 py-1.5 text-right">{p.y.toFixed(3)}</td>
                <td className="px-3 py-1.5 text-center">{r ? `${r.from.name}–${r.to.name}` : ""}</td>
                <td className="px-3 py-1.5 text-right">{r ? r.length.toFixed(2) : ""}</td>
                <td className="px-3 py-1.5 text-right">{r ? formatDms(r.angle) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Дирекцийн өнцгийг X (хойд) тэнхлэгээс цагийн зүүний дагуу хэмжив.
        {closed ? " Сүүлийн тал эхний цэг рүү буцаж хаагдана." : ""} Хасагдсан цэгүүд каталогт орохгүй.
      </p>
    </div>
  );
}

// ─── Суурь зурагтай (хиймэл дагуул / гудамж) зураг ───────────────────────────
// UTM → WGS84 → Web Mercator пиксел. Хавтан (tile) зургуудыг өөрсдөө байрлуулна —
// газрын зургийн сан хэрэггүй. Зөвхөн харах зорилготой (MONREF97 ≈ WGS84).
export type Basemap = "satellite" | "street" | "none";

const TILE = 256;
const BASEMAPS: Record<Exclude<Basemap, "none">, { url: (z: number, x: number, y: number) => string; maxZoom: number; credit: string }> = {
  satellite: {
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    maxZoom: 19,
    credit: "Зураг: Esri, Maxar, Earthstar Geographics",
  },
  street: {
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    maxZoom: 19,
    credit: "© OpenStreetMap contributors",
  },
};

function mercator(lat: number, lon: number, z: number) {
  const size = TILE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function MapPlot({
  points,
  included,
  closed,
  labels,
  selected,
  onSelect,
  zone,
  basemap,
}: {
  points: CoordPoint[];
  included: CoordPoint[];
  closed: boolean;
  labels: boolean;
  selected: number | null;
  onSelect: (i: number) => void;
  zone: number;
  basemap: Exclude<Basemap, "none">;
}) {
  // Ачаалагдаагүй хавтанг (интернэтгүй үед) эвдэрсэн зургийн дүрстэй харуулахгүй
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const W = 800;
  const H = 520;
  const pad = 48;
  const source = BASEMAPS[basemap];

  // Цэг бүрийн газарзүйн байрлал (солигдсоныг зөв байранд нь)
  const geo = points.map((p) => utmToLatLon(p.swapped ? p.y : p.x, p.swapped ? p.x : p.y, zone));
  const core = points.map((p, i) => ({ p, i })).filter(({ p }) => !p.swapped && !p.outlier);
  const frame = (core.length >= 2 ? core : points.map((p, i) => ({ p, i })).filter(({ p }) => !p.swapped)).map(({ i }) => geo[i]);

  // Хүрээнд багтах хамгийн том бүхэл zoom
  let z = source.maxZoom;
  for (; z > 3; z--) {
    const px = frame.map((g) => mercator(g.lat, g.lon, z));
    const w = Math.max(...px.map((q) => q.x)) - Math.min(...px.map((q) => q.x));
    const h = Math.max(...px.map((q) => q.y)) - Math.min(...px.map((q) => q.y));
    if (w <= W - pad * 2 && h <= H - pad * 2) break;
  }
  const framePx = frame.map((g) => mercator(g.lat, g.lon, z));
  const cx = (Math.min(...framePx.map((q) => q.x)) + Math.max(...framePx.map((q) => q.x))) / 2;
  const cy = (Math.min(...framePx.map((q) => q.y)) + Math.max(...framePx.map((q) => q.y))) / 2;
  const left = cx - W / 2;
  const top = cy - H / 2;
  const screen = geo.map((g) => {
    const q = mercator(g.lat, g.lon, z);
    return { x: q.x - left, y: q.y - top };
  });
  const indexOf = new Map(points.map((p, i) => [p, i]));
  const path = included
    .map((p, k) => {
      const s = screen[indexOf.get(p)!];
      return `${k ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    })
    .join(" ");
  const inSet = new Set(included);

  // Хамрах хавтангууд
  const tiles: Array<{ x: number; y: number; key: string }> = [];
  const max = 2 ** z;
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + W) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + H) / TILE); ty++) {
      if (ty < 0 || ty >= max) continue;
      tiles.push({ x: tx, y: ty, key: `${z}/${tx}/${ty}` });
    }
  }

  // Масштаб: Mercator-ийн нэг пикселийн бодит урт тухайн өргөрөгт
  const lat = frame.reduce((a, g) => a + g.lat, 0) / Math.max(frame.length, 1);
  const metersPerPx = (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * 6378137) / (TILE * max);
  const target = W * 0.2 * metersPerPx;
  const pow = 10 ** Math.floor(Math.log10(target));
  const nice = [1, 2, 5].map((k) => k * pow).filter((v) => v <= target).pop() ?? pow;

  const line = basemap === "satellite" ? "#fde047" : "#0f766e";

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-[#e9e4d8]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Цэгүүд суурь зураг дээр">
        {tiles.map((t) => (
          <image
            key={t.key}
            href={source.url(z, ((t.x % max) + max) % max, t.y)}
            x={t.x * TILE - left}
            y={t.y * TILE - top}
            width={TILE}
            height={TILE}
            visibility={failed.has(`${basemap}/${t.key}`) ? "hidden" : "visible"}
            onError={() => setFailed((set) => new Set(set).add(`${basemap}/${t.key}`))}
          />
        ))}
        {included.length > 1 && (
          <path
            d={path + (closed ? " Z" : "")}
            fill={closed ? (basemap === "satellite" ? "rgba(253,224,71,0.18)" : "rgba(15,118,110,0.15)") : "none"}
            stroke={line}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}
        {points.map((p, i) => {
          const color = p.swapped ? "#ef4444" : p.outlier ? "#f59e0b" : line;
          const x = Math.min(W - 8, Math.max(8, screen[i].x));
          const y = Math.min(H - 8, Math.max(8, screen[i].y));
          return (
            <g key={i} onClick={() => onSelect(i)} className="cursor-pointer">
              <circle
                cx={x}
                cy={y}
                r={selected === i ? 7 : 4.5}
                fill={inSet.has(p) ? color : "#fff"}
                stroke={basemap === "satellite" ? "#111" : color}
                strokeWidth={1.5}
                strokeDasharray={p.swapped ? "3 2" : undefined}
              />
              {labels && (
                <text
                  x={x + 7}
                  y={y - 7}
                  fontSize="12"
                  fontWeight={600}
                  fill="#111"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke"
                  fontFamily="Inter, Arial"
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(${W - 34},34)`}>
          <circle r="20" cy="2" fill="rgba(255,255,255,0.85)" />
          <path d="M0,-14 L7,8 L0,3 L-7,8 Z" fill="#1f2328" />
          <text y="21" textAnchor="middle" fontSize="10" fill="#1f2328">
            Х
          </text>
        </g>
        <g transform={`translate(16,${H - 34})`}>
          <rect x="-6" y="-16" width={nice / metersPerPx + 12} height="30" rx="4" fill="rgba(255,255,255,0.85)" />
          <rect width={nice / metersPerPx} height="5" fill="#1f2328" />
          <text y="-5" fontSize="11" fill="#1f2328">
            {nice >= 1000 ? `${nice / 1000} км` : `${nice} м`}
          </text>
        </g>
      </svg>
      <span className="absolute bottom-1 right-1.5 rounded bg-white/80 px-1.5 text-[10px] text-stone-700">{source.credit}</span>
      {tiles.length > 0 && tiles.every((t) => failed.has(`${basemap}/${t.key}`)) && (
        <span className="absolute inset-x-0 top-2 mx-auto w-fit rounded-md bg-white/90 px-3 py-1 text-xs text-stone-700 shadow">
          Суурь зураг ачаалагдсангүй — интернэт холболтоо шалгана уу.
        </span>
      )}
    </div>
  );
}
