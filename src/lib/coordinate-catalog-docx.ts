// ─── Координатын каталог → Word (.docx) ───────────────────────────────────────
// Кадастрын тайланд ордог "хилийн цэгийн координатын жагсаалт" хүснэгт.
// Browser дээр ажиллана; "docx" сан том тул зөвхөн товч дарах үед ачаална.

import { formatDms, type CatalogRow, type CoordPoint } from "@/lib/coordinates";

export type CatalogInfo = {
  title: string;
  sourceName: string;
  system: string; // "UTM, 48-р бүс (MONREF97)" / "Орон нутгийн систем"
  points: CoordPoint[];
  rows: CatalogRow[];
  closed: boolean;
  area: number;
  length: number;
  official?: { area: number; diff: number; percent: number } | null;
};

export async function buildCatalogDocx(info: CatalogInfo): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    ShadingType,
  } = await import("docx");

  const font = "Times New Roman";
  const text = (value: string, opts: { bold?: boolean; size?: number } = {}) =>
    new TextRun({ text: value, font, size: opts.size ?? 22, bold: opts.bold });
  const line = (label: string, value: string) =>
    new Paragraph({ spacing: { after: 60 }, children: [text(`${label}: `, { bold: true }), text(value)] });

  const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (value: string, opts: { header?: boolean; align?: "left" | "right" | "center"; width: number }) =>
    new TableCell({
      borders,
      width: { size: opts.width, type: WidthType.PERCENTAGE },
      shading: opts.header ? { type: ShadingType.CLEAR, color: "auto", fill: "EFEAE0" } : undefined,
      children: [
        new Paragraph({
          alignment:
            opts.align === "right" ? AlignmentType.RIGHT : opts.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [text(value, { bold: opts.header, size: 20 })],
        }),
      ],
    });

  const widths = [6, 12, 17, 17, 12, 14, 22];
  const header = new TableRow({
    tableHeader: true,
    children: ["№", "Цэг", "X, м", "Y, м", "Тал", "Урт, м", "Дирекцийн өнцөг"].map((h, i) =>
      cell(h, { header: true, align: "center", width: widths[i] }),
    ),
  });
  // Мөр бүр: цэг + тэр цэгээс дараагийн цэг хүртэлх тал
  const body = info.points.map((p, i) => {
    const r = info.rows[i];
    return new TableRow({
      children: [
        cell(String(i + 1), { align: "center", width: widths[0] }),
        cell(p.name, { width: widths[1] }),
        cell(p.x.toFixed(3), { align: "right", width: widths[2] }),
        cell(p.y.toFixed(3), { align: "right", width: widths[3] }),
        cell(r ? `${r.from.name}–${r.to.name}` : "", { align: "center", width: widths[4] }),
        cell(r ? r.length.toFixed(2) : "", { align: "right", width: widths[5] }),
        cell(r ? formatDms(r.angle) : "", { align: "center", width: widths[6] }),
      ],
    });
  });

  const today = new Date();
  const date = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  const summary = [
    line("Эх файл", info.sourceName),
    line("Координатын систем", info.system),
    line("Цэгийн тоо", String(info.points.length)),
    ...(info.closed
      ? [
          line("Талбай", `${info.area.toFixed(2)} м² (${(info.area / 10000).toFixed(4)} га)`),
          line("Периметр", `${info.length.toFixed(2)} м`),
        ]
      : [line("Нийт урт", `${info.length.toFixed(2)} м`)]),
    ...(info.official
      ? [
          line(
            "Гэрчилгээний талбай",
            `${info.official.area.toFixed(2)} м² · зөрүү ${info.official.diff >= 0 ? "+" : ""}${info.official.diff.toFixed(2)} м² (${
              info.official.percent >= 0 ? "+" : ""
            }${info.official.percent.toFixed(2)}%)`,
          ),
        ]
      : []),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 850 } } },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [text(info.title, { bold: true, size: 28 })],
          }),
          ...summary,
          new Paragraph({ spacing: { after: 120 }, children: [] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }),
          new Paragraph({ spacing: { before: 120 }, children: [text("Дирекцийн өнцгийг X (хойд) тэнхлэгээс цагийн зүүний дагуу хэмжив.", { size: 18 })] }),
          new Paragraph({ spacing: { before: 480 }, children: [text("Боловсруулсан: ____________________", {})] }),
          new Paragraph({ spacing: { before: 200 }, children: [text("Хянасан: ________________________", {})] }),
          new Paragraph({ spacing: { before: 200 }, children: [text(`Огноо: ${date}`, {})] }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
