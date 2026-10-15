"use client";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRoom, useSelf } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Content } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { EditorToolbar } from "./editor-toolbar";
import { getBaseExtensions } from "./extensions/base";

const userColors = ["#0f766e", "#b88926", "#2563eb", "#be123c"];

function isEmptyDocument(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const json = editor.getJSON();
  return (
    !json.content ||
    json.content.length === 0 ||
    (json.content.length === 1 &&
      json.content[0]?.type === "paragraph" &&
      !json.content[0]?.content)
  );
}

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

// Хэрэглэгч бичихээ зогсоосноос хойш хэдэн мс-ийн дараа хадгалах
const SAVE_DELAY_MS = 1500;
const SEED_FALLBACK_MS = 4000;
// Алдаа гарвал дахин оролдох хугацаа
const RETRY_DELAY_MS = 5000;
// fetch keepalive (tab хаах үед) ~64KB-аас том body авахгүй
const KEEPALIVE_MAX_BYTES = 60_000;

// Зургийг ачаалаад editor-т оруулна (paste / drop / toolbar)
type UploadImage = (file: File) => Promise<string | null>;

function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

async function insertUploadedImages(view: EditorView, files: File[], upload: UploadImage, at?: number) {
  let pos = at;
  for (const file of files) {
    const src = await upload(file);
    if (!src || view.isDestroyed) continue;
    const node = view.state.schema.nodes.image?.create({ src, alt: file.name });
    if (!node) return;
    const insertAt = Math.min(pos ?? view.state.selection.from, view.state.doc.content.size);
    view.dispatch(view.state.tr.insert(insertAt, node));
    pos = insertAt + node.nodeSize;
  }
}

export function CollaborativeEditor({
  fileId,
  initialContent,
  readOnly = false,
  viewing = false,
  onUploadImage,
  onSaveStatusChange,
  onEditorReady,
}: {
  fileId: string;
  initialContent?: unknown;
  readOnly?: boolean;
  // "Харах" горим — засах эрхтэй ч түр зөвхөн уншина (editor дахин үүсгэхгүй)
  viewing?: boolean;
  onUploadImage?: UploadImage;
  onSaveStatusChange?: (status: SaveStatus) => void;
  // Экспорт (Word/PDF) хийхэд файлын хуудас editor-ийн агуулгыг авна
  onEditorReady?: (editor: NonNullable<ReturnType<typeof useEditor>> | null) => void;
}) {
  const room = useRoom();
  const self = useSelf();
  const provider = useMemo(() => getYjsProviderForRoom(room), [room]);
  const userName = self?.info?.name ?? "TLS user";
  const userColor = userColors[(self?.connectionId ?? 0) % userColors.length];
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Хадгалагдаагүй өөрчлөлттэй editor (null = бүгд хадгалагдсан)
  const dirtyEditor = useRef<NonNullable<ReturnType<typeof useEditor>> | null>(null);
  const saving = useRef(false);
  // DB-ийн агуулга editor-т орж дуустал (seed) хадгалахгүй. Эс бөгөөс
  // Liveblocks удаан холбогдох үед хоосон баримт DB-ийн агуулгыг дарж бичдэг байв.
  const seeded = useRef(!initialContent);
  // setTimeout дотроос хамгийн сүүлийн flush-ийг дуудахад ашиглана
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const uploadRef = useRef(onUploadImage);
  useEffect(() => {
    uploadRef.current = onUploadImage;
  }, [onUploadImage]);
  const statusCallback = useRef(onSaveStatusChange);
  useEffect(() => {
    statusCallback.current = onSaveStatusChange;
  }, [onSaveStatusChange]);

  const setStatus = useCallback((status: SaveStatus) => {
    statusCallback.current?.(status);
  }, []);

  // Хадгалагдаагүй өөрчлөлт байвал серверт илгээнэ.
  // keepalive=true нь tab хаагдаж байхад ч хүсэлтийг дуусгуулна.
  const flush = useCallback(
    async (options: { keepalive?: boolean } = {}) => {
      const editor = dirtyEditor.current;
      if (!editor || readOnly || saving.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);

      let body: string;
      try {
        body = JSON.stringify({ content: editor.getJSON() });
      } catch {
        return; // editor аль хэдийн устсан
      }

      // Илгээх агшинд "цэвэр" гэж тэмдэглэнэ — хадгалж байх хооронд
      // шинэ өөрчлөлт орж ирвэл onUpdate дахин dirty болгоно.
      dirtyEditor.current = null;
      saving.current = true;
      setStatus("saving");
      try {
        const res = await fetch(`/api/files/${fileId}/contents`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: options.keepalive && body.length < KEEPALIVE_MAX_BYTES,
        });
        if (!res.ok) throw res;
        setStatus(dirtyEditor.current ? "unsaved" : "saved");
      } catch (err) {
        // Алдаа — өөрчлөлтийг буцааж dirty болгоно
        dirtyEditor.current ??= editor;
        setStatus("error");
        // Сүлжээ тасрах, сервер (5xx) алдаа түр зуурынх тул дахин оролдоно.
        // Эрхгүй (403), lock (423), хэт том (413) зэрэгт давтах нь утгагүй.
        const status = err instanceof Response ? err.status : 0;
        const retryable = status === 0 || status >= 500 || status === 408 || status === 429;
        if (retryable) {
          saveTimer.current = setTimeout(() => void flushRef.current(), RETRY_DELAY_MS);
        }
        return;
      } finally {
        saving.current = false;
      }
      // Хадгалж байх хооронд шинэ өөрчлөлт орсон бол дахин товлоно
      if (dirtyEditor.current) {
        saveTimer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
      }
    },
    [fileId, readOnly, setStatus],
  );

  useEffect(() => {
    flushRef.current = () => flush();
  }, [flush]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !readOnly,
      extensions: [
        // Word шиг форматлах хэрэгслүүд (сервер дээрх .docx хөрвүүлэлттэй нэг жагсаалт)
        ...getBaseExtensions({ collaborative: true }),
        Collaboration.configure({ document: provider.getYDoc() }),
        CollaborationCursor.configure({
          provider,
          user: { name: userName, color: userColor },
        }),
      ],
      onUpdate: ({ editor, transaction }) => {
        if (readOnly || !seeded.current) return;
        // Өөр хүний (Liveblocks-оор ирсэн) өөрчлөлтийг тэр хүн өөрөө хадгална —
        // зөвхөн энэ хэрэглэгчийн бичсэнийг хадгална.
        const ySync = transaction.getMeta("y-sync$") as
          | { isChangeOrigin?: boolean }
          | undefined;
        if (ySync?.isChangeOrigin) return;

        dirtyEditor.current = editor;
        setStatus("unsaved");
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
      },
      editorProps: {
        // Зураг paste / чирж оруулах → ачаалаад байрлуулна
        handlePaste: (view, event) => {
          const files = imageFiles(event.clipboardData?.files);
          const upload = uploadRef.current;
          if (!files.length || !upload || !view.editable) return false;
          void insertUploadedImages(view, files, upload);
          return true;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = imageFiles(event.dataTransfer?.files);
          const upload = uploadRef.current;
          if (!files.length || !upload || !view.editable) return false;
          event.preventDefault();
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          void insertUploadedImages(view, files, upload, at);
          return true;
        },
        attributes: {
          class:
            "min-h-[70vh] bg-white px-6 py-8 text-[16px] leading-7 text-[#1f2328] outline-none shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] md:min-h-[1056px] md:px-[72px] md:py-[72px]",
        },
      },
    },
    [fileId, provider, userName, userColor, readOnly],
  );

  // Хуудаснаас гарах (өөр хуудас руу шилжих) үед хүлээгдэж буй өөрчлөлтийг
  // хаялгүй шууд хадгална. Өмнө нь timer цуцлагдаад сүүлийн 2 секундын
  // бичвэр алга болдог байсан.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush({ keepalive: true });
    };
  }, [flush]);

  // Tab хаах / refresh хийх үед: хадгалахыг оролдож, browser-ийн
  // "Гарах уу?" анхааруулгыг харуулна.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyEditor.current && !saving.current) return;
      void flush({ keepalive: true });
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flush]);

  // DB-ээс ирсэн агуулгыг Liveblocks өрөө sync болсны ДАРАА л, өрөө хоосон
  // байвал оруулна. Өмнө нь sync-ээс өмнө оруулдаг байсан тул өөр хүн нээлттэй
  // байсан баримт хоёр давхар болдог байв. Liveblocks холбогдохгүй бол
  // SEED_FALLBACK_MS-ийн дараа DB-ийн агуулгыг харуулна (хоосон хуудас үлдээхгүй).
  useEffect(() => {
    if (!editor) return;
    // Өөр баримт руу шилжихэд дахин seed дуустал хадгалахгүй
    seeded.current = !initialContent;
    if (!initialContent) return;
    let done = false;
    const seed = () => {
      if (done || editor.isDestroyed) return;
      done = true;
      if (isEmptyDocument(editor)) editor.commands.setContent(initialContent as Content, false);
      seeded.current = true;
    };
    if (provider.synced) {
      seed();
      return;
    }
    const onSync = (synced: boolean) => {
      if (synced) seed();
    };
    provider.on("sync", onSync);
    const fallback = setTimeout(seed, SEED_FALLBACK_MS);
    return () => {
      provider.off("sync", onSync);
      clearTimeout(fallback);
    };
  }, [editor, initialContent, provider]);

  useEffect(() => {
    if (!editor) return;
    // false — "update" үйлдэл үүсгэхгүй (автомат хадгалалтыг өдөөхгүй)
    editor.setEditable(!readOnly && !viewing, false);
  }, [editor, readOnly, viewing]);

  async function pickImages(files: File[]) {
    const upload = uploadRef.current;
    if (!editor || !upload) return;
    await insertUploadedImages(editor.view, files, upload);
  }

  useEffect(() => {
    onEditorReady?.(editor ?? null);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {!readOnly && !viewing && (
        <EditorToolbar editor={editor} onPickImages={onUploadImage ? (f) => void pickImages(f) : undefined} />
      )}
      {/* Google Docs шиг саарал дэвсгэр дээр цагаан A4 хуудас */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f1efe9] px-2 py-4 md:px-6 md:py-8">
        <EditorContent editor={editor} className="mx-auto max-w-[816px]" />
      </div>
    </div>
  );
}
