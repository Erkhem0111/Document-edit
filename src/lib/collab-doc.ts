import * as Y from "yjs";
import { getSchema, type JSONContent } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { Liveblocks } from "@liveblocks/node";
import { getBaseExtensions } from "@/app/editor/extensions/base";
import { prisma } from "@/lib/prisma";

// ─── Хамтын засварын баримт (сервер тал) ─────────────────────────────────────
// Liveblocks өрөөний Yjs баримт бол үнэн эх сурвалж. Сервер:
//  • өрөө хоосон бол DB-ийн агуулгаар НЭГ удаа бөглөнө (seed) — клиент бүр
//    өөрөө бөглөдөг байсан тул зэрэг нээхэд агуулга давхардаж болдог байв;
//  • хадгалахдаа клиентийн илгээсэн хуулбарыг биш, өрөөний нэгдсэн баримтыг
//    DB-д бичнэ — "сүүлд бичсэн нь ялах" асуудалгүй, хэн ч бусдын засварыг дарахгүй.

// Tiptap Collaboration extension-ий анхдагч талбар
const FIELD = "default";

let schema: ReturnType<typeof getSchema> | null = null;
function collabSchema() {
  schema ??= getSchema(getBaseExtensions({ collaborative: true }));
  return schema;
}

export function roomIdForFile(fileId: string) {
  return `file:${fileId}`;
}

export function liveblocksClient(): Liveblocks | null {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return null;
  // LIVEBLOCKS_BASE_URL — зөвхөн тестэд (Liveblocks-ийн REST-ийг дуурайсан сервер)
  const baseUrl = process.env.LIVEBLOCKS_BASE_URL;
  return new Liveblocks({ secret, ...(baseUrl ? { baseUrl } : {}) });
}

// Агуулгагүй баримт: зангилаагүй эсвэл ганц хоосон догол мөр (editor-ийн
// isEmptyDocument-тэй ижил дүрэм)
export function isEmptyDocJson(doc: JSONContent | null | undefined) {
  const nodes = doc?.content ?? [];
  return (
    nodes.length === 0 ||
    (nodes.length === 1 && nodes[0]?.type === "paragraph" && !nodes[0]?.content?.length)
  );
}

export function isTiptapDoc(value: unknown): value is JSONContent {
  const doc = value as { type?: unknown; content?: unknown } | null;
  return (
    !!doc &&
    typeof doc === "object" &&
    doc.type === "doc" &&
    (doc.content === undefined || Array.isArray(doc.content))
  );
}

export function docJsonFromYDoc(ydoc: Y.Doc): JSONContent {
  return yXmlFragmentToProsemirrorJSON(ydoc.getXmlFragment(FIELD)) as JSONContent;
}

export function yDocFromUpdate(update: Uint8Array | ArrayBuffer) {
  const ydoc = new Y.Doc();
  const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
  if (bytes.byteLength > 0) Y.applyUpdate(ydoc, bytes);
  return ydoc;
}

// Өрөөний одоогийн төлөв дээр (stateVector-оос хойшхи) "агуулгыг content-ээр
// соль" гэсэн update. Хоосон догол мөр л байсан өрөөнд ч давхардал үүсгэхгүй.
export function replaceContentUpdate(current: Y.Doc, content: JSONContent): Uint8Array {
  const before = Y.encodeStateVector(current);
  const fragment = current.getXmlFragment(FIELD);
  current.transact(() => {
    if (fragment.length > 0) fragment.delete(0, fragment.length);
    prosemirrorJSONToYXmlFragment(collabSchema(), content, fragment);
  });
  return Y.encodeStateAsUpdate(current, before);
}

function isNotFound(error: unknown) {
  return (error as { status?: number } | null)?.status === 404;
}

// Өрөөний Yjs баримтыг уншина. Өрөө байхгүй бол null.
export async function readRoomDoc(lb: Liveblocks, fileId: string): Promise<Y.Doc | null> {
  try {
    return yDocFromUpdate(await lb.getYjsDocumentAsBinaryUpdate(roomIdForFile(fileId)));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

// Нэг serverless instance дотор саяхан шалгасан өрөөг дахин шалгахгүй (хурд).
// Алдсан ч аюулгүй — дараагийн шалгалт өрөө бөглөгдсөнийг харна.
const recentlyChecked = new Map<string, number>();
const CHECK_TTL_MS = 10 * 60 * 1000;

export type SeedResult = "cached" | "existing" | "seeded" | "no-content";

// Өрөө хоосон бол DB-ийн агуулгаар бөглөнө. Файл бүрт advisory lock — хоёр хүн
// яг зэрэг нээхэд нэг нь л бөглөж, нөгөө нь бөглөгдсөн өрөөг харна.
export async function ensureRoomSeeded(lb: Liveblocks, fileId: string): Promise<SeedResult> {
  const room = roomIdForFile(fileId);
  const checkedAt = recentlyChecked.get(room);
  if (checkedAt && Date.now() - checkedAt < CHECK_TTL_MS) return "cached";

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`collab-seed:${fileId}`}))`;
      let current = await readRoomDoc(lb, fileId);
      if (current && !isEmptyDocJson(docJsonFromYDoc(current))) return "existing" as const;

      // Том JSON-ийг зөвхөн өрөө хоосон үед л уншина
      const file = await tx.projectFile.findUnique({ where: { id: fileId }, select: { content: true } });
      const content = file?.content;
      if (!isTiptapDoc(content) || isEmptyDocJson(content)) return "no-content" as const;

      if (!current) {
        await lb.getOrCreateRoom(room, { defaultAccesses: [] });
        current = new Y.Doc();
      }
      await lb.sendYjsBinaryUpdate(room, replaceContentUpdate(current, content));
      return "seeded" as const;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  recentlyChecked.set(room, Date.now());
  return result;
}

// Хадгалах: өрөөний нэгдсэн баримт. null — өрөө байхгүй (хэн ч холбогдоогүй).
export async function roomContentForSave(
  lb: Liveblocks,
  fileId: string,
): Promise<{ json: JSONContent; empty: boolean } | null> {
  const doc = await readRoomDoc(lb, fileId);
  if (!doc) return null;
  const json = docJsonFromYDoc(doc);
  return { json, empty: isEmptyDocJson(json) };
}
