"use client";

import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Highlighter,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Plus,
  Quote,
  Redo,
  RemoveFormatting,
  SeparatorHorizontal,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Google Docs маягийн нэг мөр toolbar ──────────────────────────────────────
// Өдөр бүр хэрэглэдэг нь урд, ховор хэрэглэдэг нь "⋯" дотор.

const FONT_FAMILIES = [
  { label: "Үндсэн", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60];
const DEFAULT_SIZE = 16;

const ALIGNS = [
  { value: "left", label: "Зүүн тийш", icon: AlignLeft },
  { value: "center", label: "Голлуулах", icon: AlignCenter },
  { value: "right", label: "Баруун тийш", icon: AlignRight },
  { value: "justify", label: "Тэгшлэх", icon: AlignJustify },
] as const;

export function EditorToolbar({
  editor,
  onPickImages,
}: {
  editor: Editor | null;
  // Өгөөгүй бол зураг оруулах товч харагдахгүй
  onPickImages?: (files: File[]) => void;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  if (!editor) return null;

  const textStyle = editor.getAttributes("textStyle");
  const currentFont = (textStyle.fontFamily as string) ?? "";
  const currentSize = Number(String(textStyle.fontSize ?? "").replace("px", "")) || DEFAULT_SIZE;
  const currentColor = (textStyle.color as string) ?? "#1f2328";
  const currentHighlight = (editor.getAttributes("highlight").color as string) ?? "#fde68a";
  const currentAlign = ALIGNS.find((a) => editor.isActive({ textAlign: a.value })) ?? ALIGNS[0];
  const AlignIcon = currentAlign.icon;

  const currentBlock = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  const chain = () => editor.chain().focus();

  function setBlock(value: string) {
    if (value === "p") chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run();
  }

  function stepSize(direction: 1 | -1) {
    const next =
      direction > 0
        ? (FONT_SIZES.find((s) => s > currentSize) ?? FONT_SIZES.at(-1)!)
        : ([...FONT_SIZES].reverse().find((s) => s < currentSize) ?? FONT_SIZES[0]);
    if (next === DEFAULT_SIZE) chain().unsetFontSize().run();
    else chain().setFontSize(`${next}px`).run();
  }

  function setLink() {
    const prev = (editor!.getAttributes("link").href as string) ?? "";
    const url = window.prompt("Холбоос (URL):", prev);
    if (url === null) return;
    if (url === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex shrink-0 justify-center border-b border-border bg-background px-2 py-1.5">
      <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-card px-2 py-0.5 shadow-sm ring-1 ring-border/70 [&>*]:shrink-0">
        <Btn label="Буцаах (Ctrl+Z)" onClick={() => chain().undo().run()}>
          <Undo />
        </Btn>
        <Btn label="Дахих (Ctrl+Y)" onClick={() => chain().redo().run()}>
          <Redo />
        </Btn>
        <Sep />

        <select
          value={currentBlock}
          onChange={(e) => setBlock(e.target.value)}
          title="Хэв маяг"
          className="h-8 w-32 cursor-pointer rounded-md bg-transparent px-1.5 text-sm outline-none hover:bg-accent"
        >
          <option value="p">Энгийн текст</option>
          <option value="h1">Гарчиг 1</option>
          <option value="h2">Гарчиг 2</option>
          <option value="h3">Гарчиг 3</option>
        </select>
        <Sep />
        <select
          value={currentFont}
          onChange={(e) =>
            e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run()
          }
          title="Фонт"
          className="h-8 w-28 cursor-pointer rounded-md bg-transparent px-1.5 text-sm outline-none hover:bg-accent"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Sep />

        {/* Үсгийн хэмжээ: − 16 + */}
        <Btn label="Жижигрүүлэх" onClick={() => stepSize(-1)}>
          <Minus />
        </Btn>
        <span className="w-8 rounded border border-border text-center text-sm tabular-nums" title="Үсгийн хэмжээ">
          {currentSize}
        </span>
        <Btn label="Томруулах" onClick={() => stepSize(1)}>
          <Plus />
        </Btn>
        <Sep />

        <Btn label="Тод (Ctrl+B)" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
          <Bold />
        </Btn>
        <Btn label="Налуу (Ctrl+I)" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
          <Italic />
        </Btn>
        <Btn
          label="Доогуур зураас (Ctrl+U)"
          active={editor.isActive("underline")}
          onClick={() => chain().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </Btn>
        <ColorBtn
          label="Текстийн өнгө"
          value={currentColor}
          onChange={(c) => chain().setColor(c).run()}
          icon={<span className="text-[15px] font-semibold leading-none">A</span>}
        />
        <ColorBtn
          label="Тодруулах өнгө"
          value={currentHighlight}
          onChange={(c) => chain().setHighlight({ color: c }).run()}
          icon={<Highlighter className="size-4" />}
        />
        <Sep />

        <Btn label="Холбоос" active={editor.isActive("link")} onClick={setLink}>
          <LinkIcon />
        </Btn>
        {onPickImages && (
          <>
            <Btn label="Зураг оруулах" onClick={() => imageInput.current?.click()}>
              <ImagePlus />
            </Btn>
            <input
              ref={imageInput}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) onPickImages(files);
              }}
            />
          </>
        )}
        <Sep />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Зэрэгцүүлэлт" className={btnClass(false)}>
              <AlignIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-0">
            {ALIGNS.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem key={value} onSelect={() => chain().setTextAlign(value).run()} title={label}>
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Btn
          label="Цэгтэй жагсаалт"
          active={editor.isActive("bulletList")}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List />
        </Btn>
        <Btn
          label="Дугаартай жагсаалт"
          active={editor.isActive("orderedList")}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Btn>

        {/* Ховор хэрэглэдэг */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Бусад" className={btnClass(false)}>
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => chain().toggleStrike().run()}>
              <Strikethrough /> Дундуур зураас
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().toggleBlockquote().run()}>
              <Quote /> Ишлэл
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().toggleCodeBlock().run()}>
              <Code /> Код
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().setHorizontalRule().run()}>
              <SeparatorHorizontal /> Хуваах шугам
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => chain().unsetAllMarks().clearNodes().run()}>
              <RemoveFormatting /> Форматыг арилгах
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function btnClass(active: boolean) {
  return cn(
    "inline-flex size-8 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4",
    active && "bg-teal/15 text-teal hover:bg-teal/20 hover:text-teal",
  );
}

function Btn({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Товч дарахад editor-ийн сонголт (selection) алдагдахгүй
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={btnClass(active)}
    >
      {children}
    </button>
  );
}

function ColorBtn({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <label title={label} className={cn(btnClass(false), "relative cursor-pointer flex-col gap-0")}>
      {icon}
      <span className="mt-0.5 h-1 w-4 rounded-sm" style={{ backgroundColor: value }} />
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#1f2328"}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}
