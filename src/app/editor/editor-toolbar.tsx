"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const groups = [
    [
      {
        label: "Undo",
        icon: Undo,
        active: false,
        run: () => editor.chain().focus().undo().run(),
      },
      {
        label: "Redo",
        icon: Redo,
        active: false,
        run: () => editor.chain().focus().redo().run(),
      },
    ],
    [
      {
        label: "Heading 2",
        icon: Heading2,
        active: editor.isActive("heading", { level: 2 }),
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: "Heading 3",
        icon: Heading3,
        active: editor.isActive("heading", { level: 3 }),
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        label: "Bold",
        icon: Bold,
        active: editor.isActive("bold"),
        run: () => editor.chain().focus().toggleBold().run(),
      },
      {
        label: "Italic",
        icon: Italic,
        active: editor.isActive("italic"),
        run: () => editor.chain().focus().toggleItalic().run(),
      },
    ],
    [
      {
        label: "Bullet list",
        icon: List,
        active: editor.isActive("bulletList"),
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: "Ordered list",
        icon: ListOrdered,
        active: editor.isActive("orderedList"),
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
    ],
    [
      {
        label: "Divider",
        icon: Minus,
        active: false,
        run: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ],
  ];

  return (
    <div className="flex h-12 items-center gap-1 border-b border-border bg-card/70 px-6">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {gi > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
          {group.map(({ label, icon: Icon, active, run }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              title={label}
              onClick={run}
              className={cn("rounded-md", active && "bg-accent")}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
