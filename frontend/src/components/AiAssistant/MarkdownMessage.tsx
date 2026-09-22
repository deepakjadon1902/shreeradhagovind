import React from "react";

interface ListItem {
  text: string;
  level: number;
  children: ListItem[];
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "hr" }
  | { type: "list"; items: ListItem[] }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentParagraph: string[] = [];
  let currentList: ListItem[] | null = null;

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join("\n").trim();
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentList && currentList.length > 0) {
      blocks.push({ type: "list", items: currentList });
      currentList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    // 1. Blank line
    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    // 2. Horizontal rule: --- or ***
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }

    // 3. Headings: #, ##, ###
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    // 4. Bullet / list item: optional indentation + (* or - or + or 1.) + space + text
    const listMatch = rawLine.match(/^(\s*)([*+-]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      if (!currentList) {
        currentList = [];
      }

      const indent = listMatch[1].replace(/\t/g, "  ").length;
      const isNested = indent >= 2;
      const text = listMatch[3].trim();

      if (isNested && currentList.length > 0) {
        // Child of the previous top-level item
        const parent = currentList[currentList.length - 1];
        parent.children.push({ text, level: 1, children: [] });
      } else {
        // Top-level item
        currentList.push({ text, level: 0, children: [] });
      }
      continue;
    }

    // 5. Continuation of list item (indented text without bullet)
    if (currentList && /^\s{2,}/.test(rawLine)) {
      if (currentList.length > 0) {
        const last = currentList[currentList.length - 1];
        if (last.children.length > 0) {
          last.children[last.children.length - 1].text += " " + trimmedLine;
        } else {
          last.text += " " + trimmedLine;
        }
        continue;
      }
    }

    // 6. Normal paragraph line
    flushList();
    currentParagraph.push(rawLine);
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * Safely parses inline markdown (bold, italic, links, code) into React nodes.
 * Automatically immune to XSS as all strings are rendered as JSX children without raw HTML.
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex matching: [link](url), **bold**, __bold__, `code`, *italic*
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `inline-${match.index}-${lastIndex}`;

    if (match[2] && match[3]) {
      // Link [text](url)
      const label = match[2];
      const rawUrl = match[3].trim();
      // Only permit safe, explicit protocol URLs or relative paths
      const isSafeUrl = /^(https?:\/\/|\/|mailto:)/i.test(rawUrl);
      if (isSafeUrl) {
        nodes.push(
          <a
            key={key}
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-800 font-semibold underline hover:text-amber-900 transition-colors"
          >
            {label}
          </a>
        );
      } else {
        nodes.push(label);
      }
    } else if (match[4] || match[5]) {
      // Bold **text** or __text__
      const boldText = match[4] || match[5];
      nodes.push(
        <strong key={key} className="font-semibold text-stone-900">
          {boldText}
        </strong>
      );
    } else if (match[6]) {
      // Inline Code `code`
      const codeText = match[6];
      nodes.push(
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-amber-50 border border-amber-200/50 font-mono text-[11px] text-amber-900"
        >
          {codeText}
        </code>
      );
    } else if (match[7]) {
      // Italic *text*
      const italicText = match[7];
      nodes.push(
        <em key={key} className="italic">
          {italicText}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function MarkdownMessage({ content }: { content: string }) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="space-y-2 text-stone-800 leading-relaxed break-words">
      {blocks.map((block, bIdx) => {
        if (block.type === "hr") {
          return <hr key={bIdx} className="my-2 border-t border-[#eadfce]" />;
        }

        if (block.type === "heading") {
          return (
            <h4
              key={bIdx}
              className="font-serif font-bold text-sm text-amber-950 mt-2.5 mb-1 leading-snug"
            >
              {renderInline(block.text)}
            </h4>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={bIdx}
              className="my-1.5 pl-4 space-y-1.5 list-disc marker:text-amber-700/70"
            >
              {block.items.map((item, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  <span>{renderInline(item.text)}</span>
                  {item.children.length > 0 && (
                    <ul className="mt-1 pl-4 space-y-1 list-[circle] marker:text-amber-700/60">
                      {item.children.map((child, cIdx) => (
                        <li key={cIdx} className="leading-relaxed">
                          <span>{renderInline(child.text)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          );
        }

        // Paragraph
        const lines = block.text.split("\n");
        return (
          <p key={bIdx} className="leading-relaxed">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
