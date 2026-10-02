import type { ReactNode } from "react";

/**
 * Lille, streaming-sikker markdown-rendering uden afhængigheder og uden dangerouslySetInnerHTML.
 * Understøtter afsnit, punkt- og nummerlister, overskrifter, **fed**, `kode`, kodeblokke (også ufærdige midt i en stream)
 * og links (kun http/https eller relative, åbnes i ny fane). Alt andet vises som ren tekst.
 */

const LINK_RE = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/;

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? href : null;
  } catch {
    return null;
  }
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  const key = () => `${keyPrefix}-${n++}`;
  while (rest) {
    const code = /`([^`\n]+)`/.exec(rest);
    const bold = /\*\*([^*\n]+)\*\*/.exec(rest);
    const link = LINK_RE.exec(rest);
    const hits = [code, bold, link].filter((m): m is RegExpExecArray => Boolean(m));
    if (!hits.length) {
      out.push(rest);
      break;
    }
    const first = hits.reduce((a, b) => (b.index < a.index ? b : a));
    if (first.index > 0) out.push(rest.slice(0, first.index));
    if (first === code) out.push(<code key={key()} className="op-inline-code">{first[1]}</code>);
    else if (first === bold) out.push(<strong key={key()}>{first[1]}</strong>);
    else {
      const href = safeHref(first[2]);
      out.push(href ? <a key={key()} href={href} target="_blank" rel="noopener noreferrer">{first[1]}</a> : first[0]);
    }
    rest = rest.slice(first.index + first[0].length);
  }
  return out;
}

export type Block =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "code"; text: string; lang: string };

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^```\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // også hvis blokken endnu ikke er lukket (streaming)
      blocks.push({ type: "code", text: body.join("\n").replace(/\n+$/, ""), lang: fence[1] });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      blocks.push({ type: "h", text: line.replace(/^#{1,4}\s+/, "") });
      i++;
      continue;
    }
    const ul = /^\s*[-*•]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const re = ul.test(line) ? ul : ol;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      blocks.push({ type: ul.test(line) ? "ul" : "ol", items });
      continue;
    }
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^```/.test(lines[i]) && !/^#{1,4}\s+/.test(lines[i]) && !ul.test(lines[i]) && !ol.test(lines[i])) para.push(lines[i++]);
    blocks.push({ type: "p", text: para.join("\n") });
  }
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="op-md">
      {blocks.map((b, idx) => {
        const k = `b-${idx}`;
        if (b.type === "code") return <pre key={k} className="op-code" tabIndex={0}><code>{b.text}</code></pre>;
        if (b.type === "h") return <p key={k} className="op-md-heading">{renderInline(b.text, k)}</p>;
        if (b.type === "ul") return <ul key={k}>{b.items.map((it, j) => <li key={`${k}-${j}`}>{renderInline(it, `${k}-${j}`)}</li>)}</ul>;
        if (b.type === "ol") return <ol key={k}>{b.items.map((it, j) => <li key={`${k}-${j}`}>{renderInline(it, `${k}-${j}`)}</li>)}</ol>;
        const para = b as Extract<Block, { type: "p" }>;
        return <p key={k}>{para.text.split("\n").flatMap((l, j) => (j ? [<br key={`${k}-br-${j}`} />, ...renderInline(l, `${k}-${j}`)] : renderInline(l, `${k}-${j}`)))}</p>;
      })}
    </div>
  );
}
