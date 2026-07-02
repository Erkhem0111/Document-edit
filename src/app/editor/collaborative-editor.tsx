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

export function CollaborativeEditor({
  fileId,
  initialContent,
  readOnly = false,
}: {
  fileId: string;
  initialContent?: unknown;
  readOnly?: boolean;
}) {
  const room = useRoom();
  const self = useSelf();
  const provider = useMemo(() => getYjsProviderForRoom(room), [room]);
  const userName = self?.info?.name ?? "TLS user";
  const userColor = userColors[(self?.connectionId ?? 0) % userColors.length];
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (editor: ReturnType<typeof useEditor>) => {
      if (!editor || readOnly) return;
      const content = editor.getJSON();
      await fetch(`/api/files/${fileId}/contents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },
    [fileId, readOnly],
  );

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
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => save(editor), 2000);
      },
      editorProps: {
        attributes: {
          class:
            "min-h-[680px] rounded-2xl border border-border bg-card px-12 py-12 text-[16px] leading-8 text-foreground outline-none shadow-card",
        },
      },
    },
    [fileId, provider, userName, userColor, readOnly],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

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
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-12">
        <EditorContent editor={editor} className="mx-auto max-w-3xl" />
      </div>
    </div>
  );
}
