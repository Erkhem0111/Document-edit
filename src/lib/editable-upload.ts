import { textToTiptapDocument, type TiptapDocument } from "@/lib/editable-content";

function isPlainText(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  );
}

export function canCreateEditableContent(fileName: string, mimeType: string) {
  return isPlainText(fileName, mimeType);
}

export async function getEditableUploadContent({
  buffer,
  fileName,
  mimeType,
}: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<TiptapDocument | null> {
  if (isPlainText(fileName, mimeType)) {
    return textToTiptapDocument(buffer.toString("utf8"));
  }

  return null;
}
