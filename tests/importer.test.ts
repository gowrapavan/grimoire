import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
// @ts-expect-error plain JS module
import { parseCsv, normalizeRow, hashRecord, checkHeaders } from '../scripts/lib/gutenberg.mjs';
async function load() {
  const rows: string[][] = []; for await (const r of parseCsv([fs.readFileSync('tests/data/pg_catalog_sample.csv', 'utf8')])) rows.push(r);
  const h = rows[0]; return { h, rows: rows.slice(1).map((r) => Object.fromEntries(h.map((k: string, i: number) => [k, r[i]]))) };
}
describe('gutenberg normalization', () => {
  it('parses quotes, commas and multi-line fields; also across chunk edges', async () => {
    const { rows } = await load(); expect(rows).toHaveLength(5); expect(rows[0].Title).toBe('Test Title One, with comma'); expect(rows[1].Title).toBe('Multi\nline title');
    const txt = fs.readFileSync('tests/data/pg_catalog_sample.csv', 'utf8'); const out: string[][] = [];
    for await (const r of parseCsv(txt.match(/[\s\S]{1,7}/g)!)) out.push(r); expect(out).toHaveLength(6);
  });
  it('normalizes a good row without inventing fields', async () => {
    const r = normalizeRow((await load()).rows[0]).record;
    expect(r).toMatchObject({ source_id: '1', language: 'en', access_status: 'open_access', source_url: 'https://www.gutenberg.org/ebooks/1', publish_year: null, cover_url: null, description: null });
    expect(r.authors).toEqual(['Doe, Jane']); expect(r.subjects).toEqual(['Fiction -- Test', 'Poetry']);
  });
  it('takes the first language, collapses whitespace, skips non-text, rejects bad rows', async () => {
    const { rows } = await load();
    const r1 = normalizeRow(rows[1]); expect(r1.record.language).toBe('fr'); expect(r1.record.title).toBe('Multi line title');
    expect(normalizeRow(rows[2])).toMatchObject({ ok: false, skip: true }); expect(normalizeRow(rows[3])).toMatchObject({ ok: false, reason: 'empty title' }); expect(normalizeRow(rows[4]).ok).toBe(false);
  });
  it('hash is stable and changes with content', async () => {
    const a = normalizeRow((await load()).rows[0]).record; expect(hashRecord(a)).toBe(hashRecord({ ...a })); expect(hashRecord({ ...a, title: 'x' })).not.toBe(hashRecord(a));
  });
  it('fails loudly on a changed header', () => { expect(() => checkHeaders(['a', 'b'])).toThrow(/Feed header mismatch/); });
});
