"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Lightweight, dependency-free Markdown renderer tuned for the ASIA-BOT chat bubble.
 *
 * Supports the subset the model actually emits: headings, bold, italic,
 * strikethrough, inline code, fenced code blocks, bullet and numbered lists,
 * blockquotes, links, and horizontal rules. Everything renders through React elements
 * (no dangerouslySetInnerHTML) so it is XSS-safe by construction.
 *
 * Spacing/colors are driven by props so it matches both the dark admin theme
 * and the light student theme.
 */

export type MarkdownProps = {
  text: string;
  textColor: string;
  accent: string;
  isDark: boolean;
};

// ── Inline parsing ──────────────────────────────────────────────────────────

type InlineRule = {
  re: RegExp;
  render: (m: RegExpExecArray, key: string, theme: InlineTheme) => ReactNode;
};

type InlineTheme = { accent: string; isDark: boolean };

const codeBg = (isDark: boolean) => (isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.07)");

const INLINE_RULES: InlineRule[] = [
  // inline code — content is literal, not parsed further
  {
    re: /`([^`]+)`/,
    render: (m, key, t) => (
      <code
        key={key}
        style={{
          fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
          fontSize: "0.92em",
          background: codeBg(t.isDark),
          padding: "1px 5px",
          borderRadius: 5,
          wordBreak: "break-word",
        }}
      >
        {m[1]}
      </code>
    ),
  },
  // links [text](url)
  {
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    render: (m, key, t) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: t.accent, textDecoration: "underline", wordBreak: "break-word" }}
      >
        {parseInline(m[1], key, t)}
      </a>
    ),
  },
  // bold
  {
    re: /\*\*([^*]+?)\*\*|__([^_]+?)__/,
    render: (m, key, t) => (
      <strong key={key} style={{ fontWeight: 700 }}>
        {parseInline(m[1] ?? m[2], key, t)}
      </strong>
    ),
  },
  // strikethrough
  {
    re: /~~([^~]+?)~~/,
    render: (m, key, t) => (
      <span key={key} style={{ textDecoration: "line-through", opacity: 0.7 }}>
        {parseInline(m[1], key, t)}
      </span>
    ),
  },
  // italic
  {
    re: /\*([^*\n]+?)\*|_([^_\n]+?)_/,
    render: (m, key, t) => (
      <em key={key} style={{ fontStyle: "italic" }}>
        {parseInline(m[1] ?? m[2], key, t)}
      </em>
    ),
  },
];

function parseInline(text: string, keyPrefix: string, theme: InlineTheme): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;

  while (rest.length > 0) {
    let best: { index: number; len: number; node: ReactNode } | null = null;

    for (const rule of INLINE_RULES) {
      const m = rule.re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, len: m[0].length, node: rule.render(m, `${keyPrefix}-${i}`, theme) };
        if (m.index === 0) break; // can't beat an index-0 match
      }
    }

    if (!best) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    out.push(best.node);
    rest = rest.slice(best.index + best.len);
    i++;
  }

  return out;
}

// ── Block parsing ───────────────────────────────────────────────────────────

const HEADING_SIZE: Record<number, number> = { 1: 17, 2: 16, 3: 15, 4: 14, 5: 13.5, 6: 13 };

export default function Markdown({ text, textColor, accent, isDark }: MarkdownProps) {
  const theme: InlineTheme = { accent, isDark };
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    // skip blank lines between blocks
    if (line.trim() === "") {
      i++;
      continue;
    }

    // fenced code block ```
    const fence = line.match(/^\s*```/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence (or EOF)
      blocks.push(
        <pre
          key={key++}
          style={{
            margin: "6px 0",
            padding: "8px 10px",
            background: codeBg(isDark),
            borderRadius: 8,
            overflowX: "auto",
            fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre",
          }}
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push(
        <hr key={key++} style={{ border: "none", borderTop: `1px solid ${isDark ? "#3a3a3a" : "#e2e8f0"}`, margin: "8px 0" }} />,
      );
      i++;
      continue;
    }

    // heading
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <div
          key={key++}
          style={{ fontWeight: 700, fontSize: HEADING_SIZE[level], lineHeight: 1.35, margin: blocks.length ? "8px 0 3px" : "0 0 3px" }}
        >
          {parseInline(h[2], `h${key}`, theme)}
        </div>,
      );
      i++;
      continue;
    }

    // blockquote (group consecutive)
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          style={{
            margin: "6px 0",
            padding: "2px 0 2px 10px",
            borderLeft: `3px solid ${accent}80`,
            color: isDark ? "#bdbdbd" : "#475569",
          }}
        >
          {parseInline(buf.join("\n"), `bq${key}`, theme)}
        </blockquote>,
      );
      continue;
    }

    // unordered list (group consecutive)
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: "4px 0", paddingLeft: 20, listStyle: "disc" }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ margin: "2px 0", lineHeight: 1.55 }}>
              {parseInline(it, `ul${key}-${idx}`, theme)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // ordered list (group consecutive)
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      let start = parseInt(line.match(/^\s*(\d+)/)?.[1] ?? "1", 10);
      if (!Number.isFinite(start)) start = 1;
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} start={start} style={{ margin: "4px 0", paddingLeft: 22 }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ margin: "2px 0", lineHeight: 1.55 }}>
              {parseInline(it, `ol${key}-${idx}`, theme)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // paragraph (group consecutive non-blank, non-special lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} style={{ margin: blocks.length ? "4px 0" : "0", lineHeight: 1.6 }}>
        {para.map((ln, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {parseInline(ln, `p${key}-${idx}`, theme)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div style={{ color: textColor }}>{blocks}</div>;
}
