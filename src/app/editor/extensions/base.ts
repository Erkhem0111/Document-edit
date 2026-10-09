import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { FontSize } from "./font-size";

// Баримтын форматлах боломжууд — browser-ийн editor болон сервер дээрх
// Word (.docx) → баримт хөрвүүлэлт ИЖИЛ жагсаалт ашиглана. Ингэснээр
// хөрвүүлсэн баримт editor дээр яг адилхан харагдана.
export function getBaseExtensions({ collaborative }: { collaborative: boolean }) {
  return [
    // Collaborative үед undo/redo-г Yjs хариуцна
    collaborative ? StarterKit.configure({ history: false }) : StarterKit,
    Underline,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Link.configure({ openOnClick: false, autolink: true }),
  ];
}
