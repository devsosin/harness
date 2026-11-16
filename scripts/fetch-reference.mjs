#!/usr/bin/env node
// Fetch an HTML style guide and save it as plain Markdown-ish text, one file per <h2> section.
// Usage: node scripts/fetch-reference.mjs <url> <out-dir>
// e.g.   node scripts/fetch-reference.mjs https://google.github.io/styleguide/rustguide.html references/rust-style-guide/google
// Node 18+, no dependencies. Output is for reading/review only (references/ is git-ignored).

import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const [url, outDir] = process.argv.slice(2);
if (!url || !outDir) {
  console.error("usage: node scripts/fetch-reference.mjs <url> <out-dir>");
  process.exit(2);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function toText(html) {
  // Keep only the main content when present.
  const main = html.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const blocks = [];
  let s = main
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|nav|header|footer|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Code blocks: stash so later rules don't touch them.
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => {
      blocks.push("```\n" + decode(c.replace(/<[^>]+>/g, "")).replace(/\n+$/, "") + "\n```");
      return `\n\n\u0000${blocks.length - 1}\u0000\n\n`;
    })
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => "`" + c.replace(/<[^>]+>/g, "") + "`")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|ul|ol|table|tr|blockquote|section)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "");
  s = decode(s)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
  return s.trim() + "\n";
}

function slug(t) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "section";
}

const res = await fetch(url);
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
const text = toText(await res.text());

// Split on level-2 headings; everything before the first one goes to 00-intro.
const parts = text.split(/\n(?=## )/);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const index = [`# Source\n\n- URL: ${url}\n- Fetched: ${new Date().toISOString().slice(0, 10)}\n\n# Sections\n`];
for (const [i, part] of parts.entries()) {
  const title = part.match(/^## (.+)/)?.[1] ?? "intro";
  const name = `${String(i).padStart(2, "0")}-${slug(title)}.md`;
  await writeFile(join(outDir, name), part.trim() + "\n");
  index.push(`- [${title}](${name}) — ${part.length} chars`);
}
await writeFile(join(outDir, "INDEX.md"), index.join("\n") + "\n");
console.log(`${parts.length} sections → ${outDir} (${text.length} chars, from ${(await res.headers.get("content-length")) ?? "?"} bytes HTML)`);
