"use client";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRoom, useSelf } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorToolbar } from "./editor-toolbar";

const userColors = ["#0f766e", "#b88926", "#2563eb", "#be123c"];

export function CollaborativeEditor({ fileId }: { fileId: string }) {
  const room = useRoom();
  const self = useSelf();
  const provider = useMemo(() => getYjsProviderForRoom(room), [room]);
  const userName = self?.info?.name ?? "TLS user";
  const userColor = userColors[(self?.connectionId ?? 0) % userColors.length];
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (editor: ReturnType<typeof useEditor>) => {
      if (!editor) return;
      const content = editor.getJSON();
      await fetch(`/api/files/${fileId}/contents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },
    [fileId],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ history: false }),
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
    [fileId, provider, userName, userColor],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto px-6 py-12">
        <EditorContent editor={editor} className="mx-auto max-w-3xl" />
      </div>
    </div>
  );
}
