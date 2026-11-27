export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export type TiptapDocument = {
  type: "doc";
  content: TiptapNode[];
};

export function textToTiptapDocument(text: string): TiptapDocument {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  // Хоосон мөрөөр тусгаарлагдсан хэсэг бүр — нэг догол мөр. Догол мөр доторх
  // мөр шилжилтийг хадгална (hardBreak): CSV, координатын жагсаалт, тэмдэглэл
  // мөр мөрөөрөө харагдана. (Өмнө нь зайгаар солигдож нэг урт мөр болдог байв.)
  const blocks = normalized ? normalized.split(/\n{2,}/) : [""];

  return {
    type: "doc",
    content: blocks.map((block) => {
      const lines = block.split("\n").map((line) => line.replace(/\s+$/, ""));
      const content = lines.flatMap((line, i) => [
        ...(i > 0 ? [{ type: "hardBreak" }] : []),
        ...(line ? [{ type: "text", text: line }] : []),
      ]);
      return { type: "paragraph", content: content.length ? content : undefined };
    }),
  };
}

export function hasEditableContent(content: unknown): content is TiptapDocument {
  return (
    Boolean(content) &&
    typeof content === "object" &&
    (content as { type?: unknown }).type === "doc"
  );
}
