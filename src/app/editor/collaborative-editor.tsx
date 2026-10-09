"use client";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRoom, useSelf } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Content } from "@tiptap/core";
import { EditorToolbar } from "./editor-toolbar";
import { FontSize } from "./extensions/font-size";

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
// Алдаа гарвал дахин оролдох хугацаа
const RETRY_DELAY_MS = 5000;
// fetch keepalive (tab хаах үед) ~64KB-аас том body авахгүй
const KEEPALIVE_MAX_BYTES = 60_000;

export function CollaborativeEditor({
  fileId,
  initialContent,
  readOnly = false,
  onSaveStatusChange,
}: {
  fileId: string;
  initialContent?: unknown;
  readOnly?: boolean;
  onSaveStatusChange?: (status: SaveStatus) => void;
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
  // setTimeout дотроос хамгийн сүүлийн flush-ийг дуудахад ашиглана
  const flushRef = useRef<() => Promise<void>>(async () => {});
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
        StarterKit.configure({ history: false }),
        // Word шиг форматлах хэрэгслүүд
        Underline,
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Link.configure({ openOnClick: false, autolink: true }),
        Collaboration.configure({ document: provider.getYDoc() }),
        CollaborationCursor.configure({
          provider,
          user: { name: userName, color: userColor },
        }),
      ],
      onUpdate: ({ editor, transaction }) => {
        if (readOnly) return;
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
        attributes: {
          class:
            "min-h-[60vh] rounded-2xl border border-border bg-card px-5 py-6 text-[16px] leading-8 text-foreground outline-none shadow-card md:min-h-[680px] md:px-12 md:py-12",
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

  useEffect(() => {
    if (!editor || !initialContent || !isEmptyDocument(editor)) return;
    editor.commands.setContent(initialContent as Content, false);
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <EditorToolbar editor={editor} disabled={readOnly} />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 md:px-6 md:py-12">
        <EditorContent editor={editor} className="mx-auto max-w-3xl" />
      </div>
    </div>
  );
}
