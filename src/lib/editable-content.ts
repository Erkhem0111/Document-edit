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
  const blocks = normalized
    ? normalized.split(/\n{2,}/).map((block) => block.replace(/\n/g, " ").trim())
    : [""];

  return {
    type: "doc",
    content: blocks.map((block) => ({
      type: "paragraph",
      content: block ? [{ type: "text", text: block }] : undefined,
    })),
  };
}

export function hasEditableContent(content: unknown): content is TiptapDocument {
  return (
    Boolean(content) &&
    typeof content === "object" &&
    (content as { type?: unknown }).type === "doc"
  );
}
