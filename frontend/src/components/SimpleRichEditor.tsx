import React, { useRef, useCallback, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading2,
  Heading3,
  Quote,
  RemoveFormatting,
  Type,
} from "lucide-react";

export type FormatType =
  | "bold"
  | "italic"
  | "underline"
  | "bullet"
  | "number"
  | "h2"
  | "h3"
  | "quote"
  | "align-left"
  | "align-center"
  | "align-right"
  | "align-justify"
  | "font-serif"
  | "font-sans"
  | "font-default"
  | "size-small"
  | "size-normal"
  | "size-large"
  | "size-xl"
  | "clear";

interface SimpleRichEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  className?: string;
  extended?: boolean;
}

export function SimpleRichEditor({
  value,
  onChange,
  placeholder = "Write content here...",
  rows = 8,
  label,
  className = "",
  extended = true,
}: SimpleRichEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedFont, setSelectedFont] = useState<string>("default");
  const [selectedSize, setSelectedSize] = useState<string>("normal");

  const applyFormat = useCallback(
    (type: FormatType) => {
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const selected = value.substring(start, end);
      let replacement = "";
      let newCursorStart = start;
      let newCursorEnd = end;

      switch (type) {
        case "bold": {
          if (selected) {
            replacement = `<b>${selected}</b>`;
            newCursorStart = start;
            newCursorEnd = start + replacement.length;
          } else {
            replacement = "<b>bold text</b>";
            newCursorStart = start + 3;
            newCursorEnd = start + 12;
          }
          break;
        }
        case "italic": {
          if (selected) {
            replacement = `<i>${selected}</i>`;
            newCursorStart = start;
            newCursorEnd = start + replacement.length;
          } else {
            replacement = "<i>italic text</i>";
            newCursorStart = start + 3;
            newCursorEnd = start + 14;
          }
          break;
        }
        case "underline": {
          if (selected) {
            replacement = `<u>${selected}</u>`;
            newCursorStart = start;
            newCursorEnd = start + replacement.length;
          } else {
            replacement = "<u>underlined text</u>";
            newCursorStart = start + 3;
            newCursorEnd = start + 18;
          }
          break;
        }
        case "h2": {
          const text = selected || "Section Heading";
          replacement = `\n<h2>${text}</h2>\n`;
          newCursorStart = start + 5;
          newCursorEnd = start + 5 + text.length;
          break;
        }
        case "h3": {
          const text = selected || "Subheading";
          replacement = `\n<h3>${text}</h3>\n`;
          newCursorStart = start + 5;
          newCursorEnd = start + 5 + text.length;
          break;
        }
        case "quote": {
          const text = selected || "Devotional quote or spiritual insight...";
          replacement = `\n<blockquote>${text}</blockquote>\n`;
          newCursorStart = start + 13;
          newCursorEnd = start + 13 + text.length;
          break;
        }
        case "align-left": {
          const text = selected || "Left aligned text";
          replacement = `<div class="text-left">${text}</div>`;
          newCursorStart = start + 23;
          newCursorEnd = start + 23 + text.length;
          break;
        }
        case "align-center": {
          const text = selected || "Centered text";
          replacement = `<div class="text-center">${text}</div>`;
          newCursorStart = start + 25;
          newCursorEnd = start + 25 + text.length;
          break;
        }
        case "align-right": {
          const text = selected || "Right aligned text";
          replacement = `<div class="text-right">${text}</div>`;
          newCursorStart = start + 24;
          newCursorEnd = start + 24 + text.length;
          break;
        }
        case "align-justify": {
          const text = selected || "Justified text paragraph";
          replacement = `<div class="text-justify">${text}</div>`;
          newCursorStart = start + 26;
          newCursorEnd = start + 26 + text.length;
          break;
        }
        case "font-serif": {
          const text = selected || "Devotional serif text";
          replacement = `<span class="font-serif">${text}</span>`;
          newCursorStart = start + 24;
          newCursorEnd = start + 24 + text.length;
          break;
        }
        case "font-sans": {
          const text = selected || "Modern sans text";
          replacement = `<span class="font-sans">${text}</span>`;
          newCursorStart = start + 23;
          newCursorEnd = start + 23 + text.length;
          break;
        }
        case "font-default": {
          replacement = selected.replace(/<span class="font-(serif|sans)">([\s\S]*?)<\/span>/gi, "$2");
          newCursorStart = start;
          newCursorEnd = start + replacement.length;
          break;
        }
        case "size-small": {
          const text = selected || "Small note text";
          replacement = `<small>${text}</small>`;
          newCursorStart = start + 7;
          newCursorEnd = start + 7 + text.length;
          break;
        }
        case "size-normal": {
          replacement = selected.replace(/<(small|span class="text-(lg|xl)[^"]*")>([\s\S]*?)<\/(small|span)>/gi, "$3");
          newCursorStart = start;
          newCursorEnd = start + replacement.length;
          break;
        }
        case "size-large": {
          const text = selected || "Large emphasis text";
          replacement = `<span class="text-lg font-semibold">${text}</span>`;
          newCursorStart = start + 36;
          newCursorEnd = start + 36 + text.length;
          break;
        }
        case "size-xl": {
          const text = selected || "Extra large title text";
          replacement = `<span class="text-xl font-bold">${text}</span>`;
          newCursorStart = start + 32;
          newCursorEnd = start + 32 + text.length;
          break;
        }
        case "bullet": {
          if (selected) {
            const lines = selected.split("\n");
            replacement = lines.map((l) => (l.startsWith("• ") ? l : `• ${l}`)).join("\n");
            newCursorStart = start;
            newCursorEnd = start + replacement.length;
          } else {
            replacement = "\n• List item 1\n• List item 2\n";
            newCursorStart = start + replacement.length;
            newCursorEnd = newCursorStart;
          }
          break;
        }
        case "number": {
          if (selected) {
            const lines = selected.split("\n");
            replacement = lines.map((l, i) => (l.match(/^\d+\.\s/) ? l : `${i + 1}. ${l}`)).join("\n");
            newCursorStart = start;
            newCursorEnd = start + replacement.length;
          } else {
            replacement = "\n1. Step one\n2. Step two\n";
            newCursorStart = start + replacement.length;
            newCursorEnd = newCursorStart;
          }
          break;
        }
        case "clear": {
          if (selected) {
            replacement = selected.replace(/<[^>]*>/g, "").replace(/^[•\-\*]\s+/gm, "").replace(/^\d+\.\s+/gm, "");
            newCursorStart = start;
            newCursorEnd = start + replacement.length;
          }
          break;
        }
      }

      const updated = value.substring(0, start) + replacement + value.substring(end);
      onChange(updated);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorStart, newCursorEnd);
        }
      }, 0);
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        applyFormat("bold");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        applyFormat("italic");
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        applyFormat("underline");
      }
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <span className="text-xs font-semibold text-foreground block">{label}</span>}
      <div className="rounded-xl border border-border bg-background overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition shadow-sm">
        {/* Minimal Word-style formatting toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-border/80 bg-muted/40 p-1.5 sm:px-2 text-xs select-none">
          {/* Font Family Dropdown */}
          {extended && (
            <>
              <div className="flex items-center gap-1 bg-card border rounded px-1.5 py-0.5 shadow-2xs">
                <Type className="h-3 w-3 text-muted-foreground" />
                <select
                  aria-label="Font Family"
                  value={selectedFont}
                  onChange={(e) => {
                    const f = e.target.value;
                    setSelectedFont(f);
                    if (f === "serif") applyFormat("font-serif");
                    else if (f === "sans") applyFormat("font-sans");
                    else applyFormat("font-default");
                  }}
                  className="bg-transparent text-[11px] font-medium text-foreground focus:outline-none cursor-pointer py-0.5"
                >
                  <option value="default">Default Font</option>
                  <option value="serif">Devotional Serif</option>
                  <option value="sans">Clean Sans</option>
                </select>
              </div>

              {/* Font Size Dropdown */}
              <div className="flex items-center gap-1 bg-card border rounded px-1.5 py-0.5 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground">Size</span>
                <select
                  aria-label="Font Size"
                  value={selectedSize}
                  onChange={(e) => {
                    const s = e.target.value;
                    setSelectedSize(s);
                    if (s === "small") applyFormat("size-small");
                    else if (s === "large") applyFormat("size-large");
                    else if (s === "xl") applyFormat("size-xl");
                    else applyFormat("size-normal");
                  }}
                  className="bg-transparent text-[11px] font-medium text-foreground focus:outline-none cursor-pointer py-0.5"
                >
                  <option value="small">Small</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                  <option value="xl">Extra Large</option>
                </select>
              </div>

              <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />
            </>
          )}

          {/* Headings */}
          {extended && (
            <>
              <button
                type="button"
                onClick={() => applyFormat("h2")}
                className="h-7 px-1.5 rounded flex items-center justify-center font-bold text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Heading 2 (H2)"
              >
                <Heading2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("h3")}
                className="h-7 px-1.5 rounded flex items-center justify-center font-bold text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Heading 3 (H3)"
              >
                <Heading3 className="h-3.5 w-3.5" />
              </button>
              <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />
            </>
          )}

          {/* Basic Text Formatting */}
          <button
            type="button"
            onClick={() => applyFormat("bold")}
            className="h-7 w-7 rounded flex items-center justify-center font-bold text-foreground hover:bg-muted active:bg-muted/80 transition"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("italic")}
            className="h-7 w-7 rounded flex items-center justify-center text-foreground hover:bg-muted active:bg-muted/80 transition"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => applyFormat("underline")}
            className="h-7 w-7 rounded flex items-center justify-center text-foreground hover:bg-muted active:bg-muted/80 transition"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>

          <div className="h-4 w-px bg-border/80 mx-1" />

          {/* Text Alignment */}
          {extended && (
            <>
              <button
                type="button"
                onClick={() => applyFormat("align-left")}
                className="h-7 w-7 rounded flex items-center justify-center text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Align Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("align-center")}
                className="h-7 w-7 rounded flex items-center justify-center text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Align Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("align-right")}
                className="h-7 w-7 rounded flex items-center justify-center text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Align Right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("align-justify")}
                className="h-7 w-7 rounded flex items-center justify-center text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Justify"
              >
                <AlignJustify className="h-3.5 w-3.5" />
              </button>

              <div className="h-4 w-px bg-border/80 mx-1" />
            </>
          )}

          {/* Lists */}
          <button
            type="button"
            onClick={() => applyFormat("bullet")}
            className="h-7 px-1.5 rounded inline-flex items-center gap-1 text-foreground hover:bg-muted active:bg-muted/80 transition text-xs"
            title="Bulleted List"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px]">Bullets</span>
          </button>
          <button
            type="button"
            onClick={() => applyFormat("number")}
            className="h-7 px-1.5 rounded inline-flex items-center gap-1 text-foreground hover:bg-muted active:bg-muted/80 transition text-xs"
            title="Numbered List"
          >
            <ListOrdered className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px]">Numbered</span>
          </button>

          {/* Blockquote & Clear Formatting */}
          {extended && (
            <>
              <button
                type="button"
                onClick={() => applyFormat("quote")}
                className="h-7 px-1.5 rounded inline-flex items-center gap-1 text-foreground hover:bg-muted active:bg-muted/80 transition text-xs"
                title="Blockquote"
              >
                <Quote className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">Quote</span>
              </button>
              <button
                type="button"
                onClick={() => applyFormat("clear")}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 transition"
                title="Clear Formatting"
              >
                <RemoveFormatting className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Comfortable natural editing area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={rows}
          placeholder={placeholder}
          className="w-full bg-transparent p-4 text-sm focus:outline-none leading-relaxed font-sans resize-y min-h-[160px]"
        />
      </div>
    </div>
  );
}

/**
 * Clean & safe storefront renderer for rich formatted text.
 * Sanitizes and renders headings, paragraphs, blockquotes, lists, bold, italic, underline, alignment and font families without layout breakage.
 */
export function FormattedText({
  content,
  className = "",
}: {
  content?: string;
  className?: string;
}) {
  if (!content || !content.trim()) return null;

  const rawBlocks = content.split(/\n\s*\n/);

  return (
    <div className={`space-y-4 leading-relaxed text-foreground ${className}`}>
      {rawBlocks.map((block, bIdx) => {
        const trimmed = block.trim();

        // Check for explicit heading tags
        if (/^<h2>(.*?)<\/h2>$/is.test(trimmed)) {
          const match = trimmed.match(/^<h2>(.*?)<\/h2>$/is);
          return (
            <h2
              key={bIdx}
              className="text-2xl sm:text-3xl font-serif font-bold text-foreground mt-7 mb-3 tracking-tight border-b pb-2 border-border/40"
              dangerouslySetInnerHTML={{ __html: sanitizeSimpleHtml(match?.[1] || "") }}
            />
          );
        }

        if (/^<h3>(.*?)<\/h3>$/is.test(trimmed)) {
          const match = trimmed.match(/^<h3>(.*?)<\/h3>$/is);
          return (
            <h3
              key={bIdx}
              className="text-xl sm:text-2xl font-serif font-semibold text-foreground mt-5 mb-2"
              dangerouslySetInnerHTML={{ __html: sanitizeSimpleHtml(match?.[1] || "") }}
            />
          );
        }

        // Check for explicit blockquote
        if (/^<blockquote>(.*?)<\/blockquote>$/is.test(trimmed)) {
          const match = trimmed.match(/^<blockquote>(.*?)<\/blockquote>$/is);
          return (
            <blockquote
              key={bIdx}
              className="border-l-4 border-primary bg-primary/5 p-4 my-4 rounded-r-xl italic text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeSimpleHtml(match?.[1] || "") }}
            />
          );
        }

        const lines = trimmed.split("\n");

        // Bulleted lists
        const isBulletList = lines.every((l) => l.trim().startsWith("• ") || l.trim().startsWith("- ") || l.trim().startsWith("* "));
        if (isBulletList && lines.length > 0) {
          return (
            <ul key={bIdx} className="list-disc pl-6 space-y-1.5 my-3">
              {lines.map((l, lIdx) => {
                const clean = l.replace(/^[\s•\-\*]+\s*/, "");
                return <li key={lIdx} dangerouslySetInnerHTML={{ __html: sanitizeSimpleHtml(clean) }} />;
              })}
            </ul>
          );
        }

        // Numbered lists
        const isNumberedList = lines.every((l) => /^\d+\.\s/.test(l.trim()));
        if (isNumberedList && lines.length > 0) {
          return (
            <ol key={bIdx} className="list-decimal pl-6 space-y-1.5 my-3">
              {lines.map((l, lIdx) => {
                const clean = l.replace(/^\d+\.\s*/, "");
                return <li key={lIdx} dangerouslySetInnerHTML={{ __html: sanitizeSimpleHtml(clean) }} />;
              })}
            </ol>
          );
        }

        // Paragraph with safe HTML
        return (
          <p
            key={bIdx}
            className="whitespace-pre-line leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeSimpleHtml(trimmed) }}
          />
        );
      })}
    </div>
  );
}

function sanitizeSimpleHtml(text: string): string {
  // Convert markdown bold and italic
  let sanitized = text
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>");

  // Keep safe allowed tags with safe class/align attributes
  // Disallow scripts, onerror, onclick, style injections
  return sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:[^"']*/gi, "");
}
