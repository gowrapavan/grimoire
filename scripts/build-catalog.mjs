// Usage: node scripts/build-catalog.mjs        (optional: LIMIT=500, FEED_FILE=path, OUT=public/catalog/index.json)
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { Readable } from 'node:stream';
import { checkHeaders, normalizeRow, parseCsv } from './lib/gutenberg.mjs';
import { createBuilder } from './lib/index-builder.mjs';
import { buildSeoFiles } from './lib/seo-files.mjs';
const env = process.env;
const FEED = env.FEED_URL ?? 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';
const OUT = env.OUT ?? 'public/catalog/index.json', LIMIT = env.LIMIT ? Number(env.LIMIT) : Infinity, MAX_BYTES = 20 * 1048576; // Cloudflare Pages max file is 25 MiB
if (!(LIMIT >= 1)) { console.error('LIMIT must be a positive whole number.'); process.exit(1); }
const t0 = Date.now(); let body;
if (env.FEED_FILE) body = fs.createReadStream(env.FEED_FILE, { encoding: 'utf8' });
else {
  console.log('Downloading', FEED);
  const res = await fetch(FEED, { headers: { 'User-Agent': `GrimoireCatalogBuild/0.2 (${env.IMPORT_CONTACT ?? 'personal project'})` } });
  if (!res.ok) { console.error(`Feed download failed: HTTP ${res.status}`); process.exit(1); }
  body = Readable.fromWeb(res.body).setEncoding('utf8');
}
const b = createBuilder(); const st = { rows: 0, kept: 0, skipped_not_text: 0, errors: 0 }; const samples = []; let header = null;
for await (const f of parseCsv(body)) {
  if (!header) { header = f; checkHeaders(header); continue; }
  if (f.length === 1 && f[0] === '') continue;
  st.rows++; const row = Object.fromEntries(header.map((h, i) => [h, f[i] ?? '']));
  const n = normalizeRow(row);
  if (n.skip) { st.skipped_not_text++; continue; }
  if (!n.ok) { st.errors++; if (samples.length < 5) samples.push({ id: row['Text#'], reason: n.reason }); continue; }
  if (st.kept >= LIMIT) break;
  b.add(n.record); st.kept++;
}
const index = b.finish({ generated: new Date().toISOString(), source: 'Project Gutenberg pg_catalog.csv', feed_url: FEED });
const json = JSON.stringify(index);
if (Buffer.byteLength(json) > MAX_BYTES) { console.error(`Catalog is ${(Buffer.byteLength(json) / 1048576).toFixed(1)} MB, over the 20 MB safety limit. Re-run with a LIMIT.`); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, json);
// Small per-book metadata files and sitemaps for the server (search-engine tags, share cards). Old ones are removed first.
const seoDir = path.dirname(OUT); const seo = buildSeoFiles(index, b.years());
for (const d of ['meta', 'sitemaps']) fs.rmSync(path.join(seoDir, d), { recursive: true, force: true });
for (const [name, text] of seo) { const f = path.join(seoDir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
console.log(`SEO files: ${seo.size} written next to ${OUT}`);
console.log(JSON.stringify({ ...st, unique_books: index.count, subjects: index.subjects.length, file: OUT, bytes: Buffer.byteLength(json), gzip_bytes: zlib.gzipSync(json).length, seconds: +((Date.now() - t0) / 1000).toFixed(1), sample_errors: samples }, null, 1));
