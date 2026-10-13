// TEST-ONLY synthetic feed in the real pg_catalog.csv shape. Never used by the app.
// @ts-expect-error plain JS
import { parseCsv, normalizeRow } from '../scripts/lib/gutenberg.mjs';
// @ts-expect-error plain JS
import { createBuilder } from '../scripts/lib/index-builder.mjs';
import type { CatalogIndex } from '../src/lib/staticCatalog';
export function syntheticCsv(n: number) {
  const L = ['en', 'en', 'en', 'fr', 'de', 'fi'], S = ['Fiction', 'Poetry', 'History', 'Science', 'Essays'];
  const rows = ['Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves'];
  for (let i = 1; i <= n; i++) rows.push(`${i},Text,2001-01-01,"Title ${i} of Zebra${i % 7}",${L[i % 6]},"Author, Name${i % 40}, 1800-1850",${S[i % 5]}; ${S[(i + 1) % 5]} -- Sub,PS,`);
  rows.push('9999999,Sound,2001-01-01,Audio thing,en,X,Audio,,', `${n + 1},Text,2001-01-01,,en,X,Y,,`);
  return rows.join('\n');
}
export async function buildIndex(csv: string): Promise<CatalogIndex> { return (await buildIndexWithYears(csv)).index; }
export async function buildIndexWithYears(csv: string): Promise<{ index: CatalogIndex; years: Map<string, [string, string]> }> {
  const b = createBuilder(); let h: string[] | null = null;
  for await (const f of parseCsv([csv])) { if (!h) { h = f; continue; } const n = normalizeRow(Object.fromEntries(h.map((k: string, i: number) => [k, f[i] ?? '']))); if (n.ok) b.add(n.record); }
  return { index: b.finish({ generated: 'test', source: 'synthetic' }), years: b.years() };
}
