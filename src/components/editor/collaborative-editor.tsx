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
      await fetch(`/api/files/${fileId}/content`, {
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
            "min-h-[calc(100vh-8rem)] rounded-[8px] border border-[#d8dee4] bg-white px-10 py-8 text-[15px] leading-7 text-[#1f2933] outline-none shadow-sm",
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
    <div className="flex min-h-0 flex-1 flex-col bg-[#eef2f5]">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto p-6">
        <EditorContent editor={editor} className="mx-auto max-w-4xl" />
      </div>
    </div>
  );
}
