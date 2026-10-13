import { createHash } from 'node:crypto';
// Header we EXPECT in pg_catalog.csv. Not verified against the live file from my sandbox: the importer checks it at run time and stops if it differs.
export const REQUIRED_HEADERS = ['Text#', 'Type', 'Title', 'Language', 'Authors', 'Subjects'];
export function checkHeaders(h) {
  const missing = REQUIRED_HEADERS.filter((x) => !h.includes(x));
  if (missing.length) throw new Error(`Feed header mismatch. Missing columns: ${missing.join(', ')}. Found: ${h.join(', ')}`);
}
/** Minimal RFC-4180 CSV parser over an async iterable of strings. Yields arrays of fields. */
export async function* parseCsv(chunks) {
  let field = '', row = [], q = false, first = true;
  for await (let c of chunks) {
    if (first) { c = c.replace(/^\uFEFF/, ''); first = false; }
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
      if (q) { if (ch === '"') { if (c[i + 1] === '"') { field += '"'; i++; } else if (i + 1 < c.length) q = false; else { q = 'pending'; } } else field += ch; }
      else if (q === 'pending') {}
      else if (ch === '"' && field === '') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, '')); field = ''; yield row; row = []; }
      else field += ch;
    }
    if (q === 'pending') q = false; // a quote at a chunk edge closed the field
  }
  if (field || row.length) { row.push(field); yield row; }
}
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const list = (s, max, maxLen) => [...new Set(clean(s).split(';').map(clean).filter(Boolean).map((x) => x.slice(0, maxLen)))].slice(0, max);
/** Returns { ok, record } or { ok:false, reason }. Only Text records are kept. */
export function normalizeRow(row) {
  const id = clean(row['Text#']);
  if (!/^\d{1,9}$/.test(id)) return { ok: false, reason: 'bad Text# id' };
  if (clean(row.Type) !== 'Text') return { ok: false, skip: true, reason: 'not a Text record' };
  const title = clean(row.Title).slice(0, 500);
  if (!title) return { ok: false, reason: 'empty title' };
  const lang = clean(row.Language).split(';')[0].trim().toLowerCase();
  // Years are removed from the name shown in the app, but kept on the side (author_years) for author pages: [name, born, died].
  const author_years = [];
  const authors = list(row.Authors, 10, 200).map((a) => {
    const stripped = a.replace(/,\s*(?:\d{3,4}\??)?\s*-\s*(?:\d{3,4}\??)?\s*$/, ''); const m = /,\s*(\d{3,4})\??\s*-\s*(\d{3,4})?\??\s*$/.exec(a);
    if (m) author_years.push([stripped, m[1], m[2] ?? '']); return stripped;
  });
  const subjects = list(row.Subjects, 15, 120);
  const record = {
    source: 'gutenberg', source_id: id, title, description: null, language: /^[a-z]{2,3}$/.test(lang) ? lang : null, publish_year: null,
    // Gutenberg catalog has no original print date; "Issued" is the Gutenberg release date, so it is NOT used as publish_year.
    access_status: 'open_access', source_url: `https://www.gutenberg.org/ebooks/${id}`, cover_url: null, authors, author_years, subjects,
    provenance: { feed: 'pg_catalog.csv', issued: clean(row.Issued) || null, rights: 'per Project Gutenberg', cover: 'none in feed' },
  };
  return { ok: true, record };
}
export const hashRecord = (r) => createHash('sha256').update(JSON.stringify([r.title, r.language, r.access_status, r.source_url, r.authors, r.subjects, r.provenance])).digest('hex');
