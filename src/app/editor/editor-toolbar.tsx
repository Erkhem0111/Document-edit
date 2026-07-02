"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Minus,
  Quote,
  Code,
  Highlighter,
  Link as LinkIcon,
  Baseline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
];

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "30", "36", "48"];

export function EditorToolbar({
  editor,
  disabled = false,
}: {
  editor: Editor | null;
  disabled?: boolean;
}) {
  if (!editor) return null;

  // ─── Идэвхтэй утгууд ─────────────────────────────────────────────────────────
  const currentFont = (editor.getAttributes("textStyle").fontFamily as string) ?? "";
  const currentSizeRaw = (editor.getAttributes("textStyle").fontSize as string) ?? "";
  const currentSize = currentSizeRaw.replace("px", "");
  const currentColor =
    (editor.getAttributes("textStyle").color as string) ?? "#0f172a";

  const currentBlock = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  function setBlock(value: string) {
    if (disabled) return;
    const chain = editor!.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run();
  }

  function setLink() {
    if (disabled) return;
    const prev = (editor!.getAttributes("link").href as string) ?? "";
    const url = window.prompt("Линк (URL):", prev);
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const buttons = [
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
    {
      label: "Underline",
      icon: UnderlineIcon,
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Highlight",
      icon: Highlighter,
      active: editor.isActive("highlight"),
      run: () => editor.chain().focus().toggleHighlight().run(),
    },
  ];

  const alignButtons = [
    { label: "Align left", icon: AlignLeft, value: "left" },
    { label: "Align center", icon: AlignCenter, value: "center" },
    { label: "Align right", icon: AlignRight, value: "right" },
    { label: "Justify", icon: AlignJustify, value: "justify" },
  ];

  const listButtons = [
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
    {
      label: "Quote",
      icon: Quote,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Code block",
      icon: Code,
      active: editor.isActive("codeBlock"),
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card/70 px-6 py-1.5">
      {/* Undo / Redo */}
      <IconBtn
        label="Undo"
        disabled={disabled}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="size-4" />
      </IconBtn>
      <IconBtn
        label="Redo"
        disabled={disabled}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="size-4" />
      </IconBtn>
      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Хэв маяг (paragraph / heading) */}
      <select
        value={currentBlock}
        disabled={disabled}
        onChange={(e) => setBlock(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
        title="Хэв маяг"
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      {/* Фонт */}
      <select
        value={currentFont}
        disabled={disabled}
        onChange={(e) =>
          e.target.value
            ? editor.chain().focus().setFontFamily(e.target.value).run()
            : editor.chain().focus().unsetFontFamily().run()
        }
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
        title="Фонт"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Үсгийн хэмжээ */}
      <select
        value={currentSize}
        disabled={disabled}
        onChange={(e) =>
          e.target.value
            ? editor.chain().focus().setFontSize(`${e.target.value}px`).run()
            : editor.chain().focus().unsetFontSize().run()
        }
        className="h-8 w-16 rounded-md border border-input bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
        title="Үсгийн хэмжээ"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Bold / Italic / Underline / Strike / Highlight */}
      {buttons.map(({ label, icon: Icon, active, run }) => (
        <IconBtn
          key={label}
          label={label}
          active={active}
          disabled={disabled}
          onClick={run}
        >
          <Icon className="size-4" />
        </IconBtn>
      ))}

      {/* Текстийн өнгө */}
      <label
        className={cn(
          "relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
        title="Текстийн өнгө"
      >
        <Baseline className="size-4" style={{ color: currentColor }} />
        <input
          type="color"
          value={currentColor}
          disabled={disabled}
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>
      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Зэрэгцүүлэлт */}
      {alignButtons.map(({ label, icon: Icon, value }) => (
        <IconBtn
          key={label}
          label={label}
          active={editor.isActive({ textAlign: value })}
          disabled={disabled}
          onClick={() => editor.chain().focus().setTextAlign(value).run()}
        >
          <Icon className="size-4" />
        </IconBtn>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Жагсаалт / quote / code */}
      {listButtons.map(({ label, icon: Icon, active, run }) => (
        <IconBtn
          key={label}
          label={label}
          active={active}
          disabled={disabled}
          onClick={run}
        >
          <Icon className="size-4" />
        </IconBtn>
      ))}
      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Линк / зураас */}
      <IconBtn
        label="Link"
        active={editor.isActive("link")}
        disabled={disabled}
        onClick={setLink}
      >
        <LinkIcon className="size-4" />
      </IconBtn>
      <IconBtn
        label="Divider"
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  label,
  active,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("size-8 rounded-md", active && "bg-accent text-foreground")}
    >
      {children}
    </Button>
  );
}
