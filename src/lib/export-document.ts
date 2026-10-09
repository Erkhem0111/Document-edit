// ─── Баримтыг Word (.docx) болон PDF (хэвлэх) болгох ──────────────────────────
// Browser дээр ажиллана. "docx" сан нь том тул зөвхөн товч дарах үед
// ачаалагдана (dynamic import) — хуудасны эхний ачааллыг удаашруулахгүй.

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: Mark[];
};

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Баримт";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// "#b88926" / "rgb(1,2,3)" → "B88926" (docx-д # тэмдэггүй hex хэрэгтэй)
function toHex(color: unknown): string | undefined {
  if (typeof color !== "string") return undefined;
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) return hex[1].toUpperCase();
  const short = color.match(/^#([0-9a-f]{3})$/i);
  if (short) return short[1].split("").map((c) => c + c).join("").toUpperCase();
  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return rgb
      .slice(1, 4)
      .map((v) => Number(v).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return undefined;
}

export async function exportToDocx(json: unknown, title: string) {
  const docx = await import("docx");
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    LevelFormat,
    Packer,
    Paragraph,
    ShadingType,
    TextRun,
  } = docx;

  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];
  const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED,
  };

  type Inline = InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>;

  function runsOf(nodes: Node[] = [], extra: { font?: string; italics?: boolean } = {}): Inline[] {
    const runs: Inline[] = [];
    for (const node of nodes) {
      if (node.type === "hardBreak") {
        runs.push(new TextRun({ text: "", break: 1 }));
        continue;
      }
      if (node.type !== "text" || !node.text) continue;
      const marks = node.marks ?? [];
      const has = (t: string) => marks.some((m) => m.type === t);
      const style = marks.find((m) => m.type === "textStyle")?.attrs ?? {};
      const highlight = marks.find((m) => m.type === "highlight")?.attrs;
      const link = marks.find((m) => m.type === "link")?.attrs;
      const px = typeof style.fontSize === "string" ? parseFloat(style.fontSize) : NaN;
      const fill = highlight ? (toHex(highlight.color) ?? "FFF59D") : undefined;

      const run = new TextRun({
        text: node.text,
        bold: has("bold"),
        italics: has("italic") || extra.italics,
        strike: has("strike"),
        underline: has("underline") || link ? {} : undefined,
        color: toHex(style.color) ?? (link ? "1D4ED8" : undefined),
        font: has("code") ? "Courier New" : (extra.font ?? (style.fontFamily as string | undefined)?.split(",")[0]?.replace(/['"]/g, "")),
        // px → half-points (1px = 0.75pt)
        size: Number.isFinite(px) ? Math.round(px * 1.5) : undefined,
        shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
      });
      runs.push(
        typeof link?.href === "string"
          ? new ExternalHyperlink({ link: link.href, children: [run] })
          : run,
      );
    }
    return runs;
  }

  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  function walk(nodes: Node[] = [], ctx: { list?: "bullet" | "ordered"; level: number; quote?: boolean }) {
    for (const node of nodes) {
      const alignment = ALIGN[String(node.attrs?.textAlign ?? "")];
      switch (node.type) {
        case "paragraph":
          paragraphs.push(
            new Paragraph({
              alignment,
              children: runsOf(node.content, { italics: ctx.quote }),
              indent: ctx.quote ? { left: 720 } : undefined,
              ...(ctx.list === "bullet"
                ? { bullet: { level: ctx.level } }
                : ctx.list === "ordered"
                  ? { numbering: { reference: "ordered", level: ctx.level } }
                  : {}),
            }),
          );
          break;
        case "heading": {
          const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
          paragraphs.push(
            new Paragraph({ heading: HEADINGS[level - 1], alignment, children: runsOf(node.content) }),
          );
          break;
        }
        case "bulletList":
        case "orderedList":
          for (const item of node.content ?? []) {
            walk(item.content, {
              list: node.type === "bulletList" ? "bullet" : "ordered",
              level: ctx.list ? ctx.level + 1 : 0,
              quote: ctx.quote,
            });
          }
          break;
        case "blockquote":
          walk(node.content, { ...ctx, quote: true });
          break;
        case "codeBlock":
          for (const line of (node.content?.map((n) => n.text ?? "").join("") ?? "").split("\n")) {
            paragraphs.push(
              new Paragraph({
                children: [new TextRun({ text: line, font: "Courier New" })],
                shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" },
              }),
            );
          }
          break;
        case "horizontalRule":
          paragraphs.push(
            new Paragraph({
              children: [],
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } },
            }),
          );
          break;
        default:
          if (node.content) walk(node.content, ctx);
      }
    }
  }

  walk((json as Node)?.content, { level: 0 });

  const doc = new Document({
    title,
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [0, 1, 2, 3, 4, 5].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph({ children: [] })] }],
  });

  downloadBlob(await Packer.toBlob(doc), `${safeFileName(title)}.docx`);
}

// PDF: шинэ цонхонд зөвхөн баримтын агуулгыг цэвэрхэн байрлуулаад browser-ийн
// хэвлэх цонхыг нээнэ — тэндээс "Save as PDF" сонгоно. Нэмэлт сан шаардахгүй,
// монгол үсэг, формат зөв гарна.
export function printDocument(html: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) return false;
  const escapedTitle = title.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
  win.document.write(`<!doctype html><html lang="mn"><head><meta charset="utf-8">
<title>${escapedTitle}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; line-height: 1.6; color: #111; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22pt; } h2 { font-size: 17pt; } h3 { font-size: 14pt; }
  blockquote { border-left: 3px solid #999; margin: 0; padding-left: 12px; color: #444; }
  pre { background: #f3f4f6; padding: 10px; border-radius: 4px; white-space: pre-wrap; }
  a { color: #1d4ed8; }
  hr { border: 0; border-top: 1px solid #999; }
</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  // Фонт, зураг ачаалагдахыг жаахан хүлээгээд хэвлэнэ
  setTimeout(() => {
    win.print();
  }, 300);
  return true;
}
