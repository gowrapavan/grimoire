import { describe, expect, it } from 'vitest';
import { parseParams, hasCriteria, PAGE_SIZE, MAX_PAGE_SIZE } from '../src/lib/params';
import { makeCatalog } from '../src/lib/staticCatalog';
import { buildIndex, syntheticCsv } from './helpers';
import { ACCESS } from '../src/lib/access';
const P = (s: string) => parseParams(new URLSearchParams(s));
describe('param validation', () => {
  it('trims, collapses and caps the query', () => { expect(P('q=%20%20a%20%20b ').q).toBe('a b'); expect(P('q=' + 'x'.repeat(500)).q.length).toBe(100); });
  it('rejects bad values', () => {
    const p = P('language=%3Cscript%3E&access=free&sort=drop&page=-4&from=abc&to=99999');
    expect(p.language).toBe(''); expect(p.access).toBeUndefined(); expect(p.page).toBe(1); expect(p.yearFrom).toBeUndefined(); expect(p.yearTo).toBeUndefined(); expect(p.sort).toBe('title');
  });
  it('swaps reversed years and caps page', () => { const p = P('from=1950&to=1900&page=99999'); expect([p.yearFrom, p.yearTo, p.page]).toEqual([1900, 1950, 1]); });
  it('empty search is not run', () => { expect(hasCriteria(P(''))).toBe(false); expect(hasCriteria(P('q=a'))).toBe(true); });
  it('page size never exceeds 50', () => expect(PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE));
});
describe('static catalog (synthetic feed, test only)', async () => {
  const c = makeCatalog(await buildIndex(syntheticCsv(60)));
  it('drops non-text and invalid rows', async () => expect((await c.search(P('language=en&q=title'))).total + (await c.search(P('language=fr&q=title'))).total + (await c.search(P('language=de&q=title'))).total + (await c.search(P('language=fi&q=title'))).total).toBe(60));
  it('matches title and author prefixes, all words, ignoring case', async () => {
    expect((await c.search(P('q=TITLE 7 zebra0'))).total).toBe(1); expect((await c.search(P('q=name3'))).total).toBe(12); expect((await c.search(P('q=name39'))).total).toBe(1); expect((await c.search(P('q=zzzz'))).total).toBe(0);
  });
  it('paginates at 24 and never exceeds 50', async () => { const r = await c.search(P('q=title')); expect(r.items).toHaveLength(24); expect((await c.search(P('q=title&page=3'))).items).toHaveLength(12); expect((await c.search(P('q=title&page=9'))).items).toHaveLength(0); });
  it('filters by subject, language; unknown subject is empty, not everything', async () => {
    expect((await c.search(P('subject=Poetry'))).total).toBe(12); expect((await c.search(P('subject=Nope'))).total).toBe(0); expect((await c.search(P('language=fi'))).total).toBe(10);
  });
  it('year filter matches nothing because Gutenberg has no print year', async () => expect((await c.search(P('from=1900&to=1950'))).total).toBe(0));
  it('detail lookup and source link', async () => { const b = await c.get('5'); expect(b?.sourceUrl).toBe('https://www.gutenberg.org/ebooks/5'); expect(b?.accessStatus).toBe('open_access'); expect(b?.coverUrl).toBe('https://www.gutenberg.org/cache/epub/5/pg5.cover.medium.jpg'); expect(b?.readUrl).toBe('https://www.gutenberg.org/cache/epub/5/pg5-images.html'); expect(await c.get('0')).toBeNull(); });
  it('recent sorts by highest id; title sort is alphabetical', async () => { expect((await c.recent(1))[0].id).toBe('60'); const t = (await c.search(P('sort=title'))).items.map((b) => b.title); expect(t).toEqual([...t].sort()); });
  it('subject list is counted', async () => expect((await c.subjects())[0].count).toBeGreaterThan(10));
});
describe('access model', () => {
  it('only the four allowed statuses exist', () => expect(Object.keys(ACCESS).sort()).toEqual(['borrowable', 'external_link', 'metadata_only', 'open_access']));
});
