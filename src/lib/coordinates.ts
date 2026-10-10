// ─── Координатын файл: уншиx, шалгах, тооцоолох, экспорт ──────────────────────
// Геодезийн заншлаар X = хойд (northing), Y = зүүн (easting).
// Монгол: MONREF97 (≈ WGS84), UTM 46–50-р бүс; хот суурин газар орон нутгийн
// систем ч хэрэглэгддэг — тэр үед зөвхөн хавтгай тооцоо хийнэ (WGS84 руу хөрвүүлэхгүй).

export type CoordPoint = {
  name: string;
  x: number; // хойд (northing)
  y: number; // зүүн (easting)
  z?: number;
  code?: string;
  line: number; // файлын мөрийн дугаар (1-ээс)
  swapped?: boolean; // X/Y солигдсон байж болзошгүй
  outlier?: boolean; // бусдаасаа хэт хол
};

export type ParsedCoordinates = {
  points: CoordPoint[];
  zone: number | null; // Y-ийн өмнөх бүсийн дугаараас (жишээ 48 650 123.45)
  local: boolean; // UTM биш (орон нутгийн / нөхцөлт) систем
  skipped: number; // уншиж чадаагүй мөр
  columns: string; // аль баганыг юу гэж ойлгосныг хүнд тайлбарлах
};

const COORD_EXT = /\.(csv|txt|xyz|pts|dat|asc)$/i;
export function isCoordinateFileName(name: string) {
  return COORD_EXT.test(name);
}

// Монгол улсын нутаг: UTM хойд 4.6–5.8 сая м, зүүн 160–840 мянга м
const inNorth = (v: number) => v >= 4.0e6 && v < 6.0e6;
const inEast = (v: number) => v >= 1.6e5 && v < 8.4e5;
const inZonedEast = (v: number) => v >= 43e6 && v < 53e6 && inEast(v % 1e6);

function splitLine(line: string, delimiter: string | null) {
  return (delimiter ? line.split(delimiter) : line.split(/\s+/))
    .map((t) => t.trim().replace(/^"(.*)"$/, "$1"))
    .filter((t, i, arr) => !(delimiter === null && t === "" && (i === 0 || i === arr.length - 1)));
}

function toNumber(token: string, decimalComma: boolean) {
  const t = decimalComma ? token.replace(",", ".") : token;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function parseCoordinates(text: string): ParsedCoordinates {
  const rawLines = text.replace(/^﻿/, "").split(/\r?\n/);
  const lines = rawLines
    .map((l, i) => ({ text: l.trim(), line: i + 1 }))
    .filter((l) => l.text && !l.text.startsWith("#") && !l.text.startsWith("//"));

  // Тусгаарлагчийг эхний мөрүүдээс таана
  const sample = lines.slice(0, 20).map((l) => l.text);
  const count = (ch: string) => sample.reduce((n, l) => n + l.split(ch).length - 1, 0);
  const candidates: Array<[string, number]> = [
    ["\t", count("\t")],
    [";", count(";")],
    [",", count(",")],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  const delimiter = candidates[0][1] >= sample.length ? candidates[0][0] : null;
  // ";" тусгаарлагчтай файлд "," нь бутархайн тэмдэг (Excel-ийн Европ тохиргоо)
  const decimalComma = delimiter === ";" || delimiter === "\t" || delimiter === null;

  const rows = lines.map((l) => ({ line: l.line, cells: splitLine(l.text, delimiter) }));
  const width = Math.max(0, ...rows.map((r) => r.cells.length));
  const numeric = rows.map((r) => r.cells.map((c) => toNumber(c, decimalComma)));
  // Тоо багатай мөр (толгой, тайлбар) — өгөгдөл биш
  const isData = numeric.map((cells) => cells.filter((v) => v !== null).length >= 2);

  // Багана бүрийн шинж
  const cols = Array.from({ length: width }, (_, c) => {
    const vals = numeric.filter((_, r) => isData[r]).map((cells) => cells[c]).filter((v): v is number => v !== null);
    const dataRows = isData.filter(Boolean).length || 1;
    return {
      ratio: vals.length / dataRows,
      north: vals.filter(inNorth).length,
      east: vals.filter((v) => inEast(v) || inZonedEast(v)).length,
      zoned: vals.filter(inZonedEast).length,
      integers: vals.filter((v) => Number.isInteger(v) && Math.abs(v) < 1e5).length,
      count: vals.length,
    };
  });

  const numericCols = cols.map((c, i) => ({ ...c, i })).filter((c) => c.ratio >= 0.8);
  const byNorth = [...numericCols].sort((a, b) => b.north - a.north)[0];
  const byEast = [...numericCols].filter((c) => c.i !== byNorth?.i).sort((a, b) => b.east - a.east)[0];
  const utm = Boolean(byNorth && byEast && byNorth.north >= byNorth.count * 0.5 && byEast.east >= byEast.count * 0.5);

  let xCol: number;
  let yCol: number;
  let idCol: number | null = null;
  if (utm) {
    xCol = byNorth.i;
    yCol = byEast.i;
  } else {
    // Орон нутгийн систем: эхний (ID биш) хоёр тоон багана = X, Y
    const coordCols = numericCols.filter((c, k) => {
      const looksLikeId = k === 0 && numericCols.length >= 3 && c.integers >= c.count * 0.9;
      if (looksLikeId) idCol = c.i;
      return !looksLikeId;
    });
    xCol = coordCols[0]?.i ?? 0;
    yCol = coordCols[1]?.i ?? 1;
  }
  // Нэрийн багана: эхний багана нь текст эсвэл бүхэл тоон дугаар (1, 2, 3…) бол тэр;
  // үгүй бол эхний тоон бус багана. Үлдсэн текст багана = код (ХИЛ, БАРИЛГА…)
  const textCols = cols.map((c, i) => ({ ...c, i })).filter((c) => c.ratio < 0.8);
  const first = cols[0];
  const firstIsId =
    first && ![xCol, yCol].includes(0) && first.ratio >= 0.8 && first.integers >= first.count * 0.9;
  const nameCol = firstIsId || (first && first.ratio < 0.8) ? 0 : (textCols[0]?.i ?? idCol);
  const zCol =
    numericCols.find((c) => ![xCol, yCol, nameCol].includes(c.i) && c.north === 0 && c.east === 0)?.i ?? null;
  const codeCol = textCols.find((c) => c.i !== nameCol)?.i ?? null;

  let zone: number | null = null;
  let skipped = 0;
  const points: CoordPoint[] = [];
  rows.forEach((row, r) => {
    const x = numeric[r][xCol];
    const y = numeric[r][yCol];
    if (!isData[r] || x == null || y == null) {
      // Толгой мөрийг алгасалт гэж тооцохгүй (эхний мөр)
      if (r > 0 || isData[r]) skipped++;
      return;
    }
    let north = x;
    let east = y;
    let swapped = false;
    if (utm && inNorth(east) && (inEast(north) || inZonedEast(north))) {
      // Энэ мөрөнд л X/Y солигдсон (бусад нь зөв)
      swapped = true;
      [north, east] = [east, north];
    }
    if (utm && inZonedEast(east)) {
      zone = Math.floor(east / 1e6);
      east = east % 1e6;
    }
    const z = zCol != null ? numeric[r][zCol] : null;
    points.push({
      name: nameCol != null ? (row.cells[nameCol] ?? String(points.length + 1)) : String(points.length + 1),
      x: swapped ? east : north, // солигдсон мөрийг эхлээд файлд байгаагаар нь харуулна
      y: swapped ? north : east,
      z: z ?? undefined,
      code: codeCol != null ? row.cells[codeCol] || undefined : undefined,
      line: row.line,
      swapped: swapped || undefined,
    });
  });

  markOutliers(points);

  const label = (i: number | null) => (i == null ? null : `${i + 1}-р багана`);
  const columns = [
    `Нэр: ${label(nameCol) ?? "дугаарлав"}`,
    `X (хойд): ${label(xCol)}`,
    `Y (зүүн): ${label(yCol)}`,
    zCol != null ? `H: ${label(zCol)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { points, zone, local: !utm, skipped, columns };
}

// Солигдсон гэж тэмдэглэсэн цэгийн X/Y-ийг солино
export function fixSwapped(points: CoordPoint[]): CoordPoint[] {
  const fixed = points.map((p) => (p.swapped ? { ...p, x: p.y, y: p.x, swapped: undefined } : p));
  markOutliers(fixed);
  return fixed;
}

// Голоосоо хэт хол цэг (хэмжилтийн/бичлэгийн алдаа байж болзошгүй)
function markOutliers(points: CoordPoint[]) {
  const usable = points.filter((p) => !p.swapped);
  if (usable.length < 4) return;
  const cx = median(usable.map((p) => p.x));
  const cy = median(usable.map((p) => p.y));
  const dist = (p: CoordPoint) => Math.hypot(p.x - cx, p.y - cy);
  const md = median(usable.map(dist));
  const limit = Math.max(md * 8, 100);
  for (const p of points) p.outlier = !p.swapped && dist(p) > limit ? true : undefined;
}

// ─── Геометр ──────────────────────────────────────────────────────────────────
export function polygonArea(points: CoordPoint[]) {
  if (points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.y * b.x - b.y * a.x;
  }
  return Math.abs(s) / 2;
}

export function segmentLengths(points: CoordPoint[], closed: boolean) {
  const out: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const b = points[i + 1] ?? (closed ? points[0] : null);
    if (!b) break;
    out.push(Math.hypot(b.x - points[i].x, b.y - points[i].y));
  }
  return out;
}

// ─── UTM → WGS84 (MONREF97 ≈ WGS84, харуулах/KML-д хангалттай) ──────────────────
export function utmToLatLon(north: number, east: number, zone: number) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const x = east - 500000;
  const m = north / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin = Math.sin(phi1);
  const cos = Math.cos(phi1);
  const tan = Math.tan(phi1);
  const n1 = a / Math.sqrt(1 - e2 * sin * sin);
  const t1 = tan * tan;
  const c1 = ep2 * cos * cos;
  const r1 = (a * (1 - e2)) / (1 - e2 * sin * sin) ** 1.5;
  const d = x / (n1 * k0);
  const lat =
    phi1 -
    ((n1 * tan) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon0 = ((zone * 6 - 183) * Math.PI) / 180;
  const lon =
    lon0 +
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
      cos;
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI };
}

// ─── Экспорт ──────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function toKml(points: CoordPoint[], zone: number, title: string, closed: boolean) {
  const ll = points.map((p) => ({ p, ...utmToLatLon(p.x, p.y, zone) }));
  const coords = [...ll, ...(closed && ll.length > 2 ? [ll[0]] : [])]
    .map((q) => `${q.lon.toFixed(8)},${q.lat.toFixed(8)},0`)
    .join(" ");
  const shape =
    closed && ll.length > 2
      ? `<Placemark><name>${esc(title)}</name><Style><LineStyle><color>ff2d7a0f</color><width>2</width></LineStyle><PolyStyle><color>402d7a0f</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
      : `<Placemark><name>${esc(title)}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
  const marks = ll
    .map((q) => `<Placemark><name>${esc(q.p.name)}</name><Point><coordinates>${q.lon.toFixed(8)},${q.lat.toFixed(8)},0</coordinates></Point></Placemark>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name>${shape}${marks}</Document></kml>`;
}

// AutoCAD R12 ASCII DXF — CAD-д X = зүүн (Y), Y = хойд (X)
export function toDxf(points: CoordPoint[], closed: boolean) {
  const out: string[] = ["0", "SECTION", "2", "ENTITIES"];
  for (const p of points) {
    const z = p.z ?? 0;
    out.push("0", "POINT", "8", "POINTS", "10", p.y.toFixed(4), "20", p.x.toFixed(4), "30", z.toFixed(4));
    out.push("0", "TEXT", "8", "LABELS", "10", (p.y + 0.3).toFixed(4), "20", (p.x + 0.3).toFixed(4), "30", z.toFixed(4), "40", "0.5", "1", p.name);
  }
  if (points.length > 1) {
    out.push("0", "POLYLINE", "8", "BOUNDARY", "66", "1", "70", closed ? "1" : "0");
    for (const p of points) out.push("0", "VERTEX", "8", "BOUNDARY", "10", p.y.toFixed(4), "20", p.x.toFixed(4), "30", "0");
    out.push("0", "SEQEND");
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\r\n");
}

export function toCsv(points: CoordPoint[]) {
  const rows = points.map((p) => [p.name, p.x.toFixed(3), p.y.toFixed(3), p.z?.toFixed(3) ?? "", p.code ?? ""].join(","));
  return ["Нэр,X,Y,H,Код", ...rows].join("\r\n");
}
