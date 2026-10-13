// Turns a Project Gutenberg plain-text file (pgNNNN.txt) into blocks and pages for an in-page reader.
export type Block = { kind: 'p' | 'verse' | 'h' | 'rule'; text: string };
export interface Parsed { pages: Block[][]; toc: { title: string; page: number }[] }
const CHAPTER = /^(chapter|book|part|section|canto|act|scene|volume|preface|prologue|epilogue|introduction|contents)\b/i;
const NUMERAL = /^([IVXLCDM]{1,8}|\d{1,3})[.)]?$/;
const isCaps = (s: string) => /[A-Z]{3}/.test(s) && !/[a-z]/.test(s);
export function stripBoilerplate(raw: string): string {
  let t = raw.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const s = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*/i);
  if (s >= 0) t = t.slice(t.indexOf('\n', s) + 1 || t.length);
  const e = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (e >= 0) t = t.slice(0, e);
  return t;
}
export function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.split(/\n[ \t]*\n/)) {
    const lines = chunk.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    if (!lines.length) continue;
    const one = lines.map((l) => l.trim()).join(' ').replace(/\s+/g, ' ');
    if (/^[\s*\-–—_=~.]{3,}$/.test(lines.join('')) && /[*\-–—_=~]/.test(lines.join(''))) { out.push({ kind: 'rule', text: '' }); continue; }
    const first = lines[0].trim();
    if (lines.length <= 2 && one.length <= 80 && (CHAPTER.test(first) || (lines.length === 1 && (NUMERAL.test(first) || isCaps(first))))) { out.push({ kind: 'h', text: one }); continue; }
    const avg = lines.reduce((n, l) => n + l.trim().length, 0) / lines.length;
    if (lines.length >= 2 && avg < 48 && Math.max(...lines.map((l) => l.trim().length)) < 70) { out.push({ kind: 'verse', text: lines.map((l) => l.replace(/\s+$/, '')).join('\n') }); continue; }
    out.push({ kind: 'p', text: one });
  }
  return out;
}
/** Groups blocks into pages of about `size` characters; a chapter heading starts a new page once the current one has some text. */
export function paginate(blocks: Block[], size = 5000): Parsed {
  const pages: Block[][] = []; const toc: Parsed['toc'] = []; let cur: Block[] = []; let n = 0;
  const flush = () => { if (cur.length) pages.push(cur); cur = []; n = 0; };
  for (const b of blocks) {
    if (b.kind === 'h' && n > 1500) flush();
    if (n > 0 && n + b.text.length > size) flush();
    if (b.kind === 'h' && toc.length < 400) toc.push({ title: b.text, page: pages.length });
    cur.push(b); n += b.text.length + 1;
  }
  flush();
  return { pages, toc };
}
export const parseGutenbergText = (raw: string, size?: number): Parsed => paginate(toBlocks(stripBoilerplate(raw)), size);
