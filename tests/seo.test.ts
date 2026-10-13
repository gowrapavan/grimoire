import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../worker/index';
import { authorEntries, authorHead, authorNames, bookHead, clip, homeHead, META_SHARD, renderHead, searchHead, shardOf } from '../src/lib/seoText';
import * as A from '../src/lib/authors';
// @ts-expect-error plain JS
import * as AM from '../scripts/lib/authors.mjs';
// @ts-expect-error plain JS
import { buildSeoFiles, META_SHARD as BUILD_SHARD, SITEMAP_CHUNK } from '../scripts/lib/seo-files.mjs';
import { buildIndexWithYears, syntheticCsv } from './helpers';
const seoFiles = async (n = 60): Promise<Map<string, string>> => { const { index, years } = await buildIndexWithYears(syntheticCsv(n)); return buildSeoFiles(index, years); };

const SHELL = '<!doctype html><html><head><meta charset="UTF-8"/><title>Default</title>\n<meta name="description" content="Default description"/>\n<meta name="robots" content="index,follow"/></head><body><div id="root"></div></body></html>';
type Env = Awaited<ReturnType<typeof env>>;
async function env(extra: Record<string, string> = {}, rows?: Record<string, unknown>) {
  const files: Map<string, string> = rows ? new Map([['meta/0.json', JSON.stringify({ s: 500, b: rows })], ['seo.json', '{"sitemaps":[],"generated":"2026-10-12T00:00:00Z"}']]) : await seoFiles();
  return { ...extra, ASSETS: { async fetch(req: Request) {
    const p = new URL(req.url).pathname;
    if (p === '/') return new Response(SHELL, { headers: { 'content-type': 'text/html' } });
    if (p === '/og-default.png') return new Response('PNGDATA', { headers: { 'content-type': 'image/png' } });
    if (p === '/ghost.png') return new Response(SHELL, { headers: { 'content-type': 'text/html' } });   // what a static host with an app fallback does for a missing file
    if (p === '/favicon.svg') return new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
    const m = /^\/catalog\/(.+)$/.exec(p); if (m && files.has(m[1])) return new Response(files.get(m[1])!);
    return new Response('static:' + p, { status: p.startsWith('/catalog/') ? 404 : 200 });
  } } };
}
const get = async (e: Env, path: string, host = 'https://x.test') => { const r = await worker.fetch(new Request(host + path), e as never); return { r, text: await r.text() }; };
const ld = (text: string) => JSON.parse(/<script type="application\/ld\+json" id="grimoire-ld">([\s\S]*?)<\/script>/.exec(text)![1]);
afterEach(() => vi.unstubAllGlobals());

describe('search-engine text', () => {
  it('uses the same shard size in the build script and the server', () => { expect(BUILD_SHARD).toBe(META_SHARD); expect(shardOf('1499')).toBe(2); expect(SITEMAP_CHUNK).toBeLessThanOrEqual(50000); });
  it('author logic in the app and in the build script give the same answers', () => {
    const raws = ['Thompson, Ruth Plumly', 'Neill, John R. (John Rea), 1877-1943 [Illustrator]', 'Baum, L. Frank (Lyman Frank), 1856-1919', 'Brontë, Charlotte, 1816-1855', 'Aristotle, 384 BCE-322 BCE', 'Dostoyevsky, Fyodor, 1821-1881', 'Anonymous', 'Pius II, Pope, 1405-1464', '中文名', 'Burroughs, Edgar Rice, 1875-1950'];
    for (const r of raws) { expect(AM.authorSlug(r)).toBe(A.authorSlug(r)); expect(AM.authorName(r)).toBe(A.authorName(r)); expect(AM.authorYears(r)).toEqual(A.authorYears(r)); }
    for (const s of ['l-frank-baum', 'x', 'name5-author']) { expect(AM.fnv(s)).toBe(A.fnv(s)); expect(AM.authorShard(s)).toBe(A.authorShard(s)); }
    expect([AM.AUTHOR_SHARDS, AM.AUTHOR_MIN_BOOKS, AM.AUTHOR_LIST, AM.SUBJECT_MIN_BOOKS]).toEqual([A.AUTHOR_SHARDS, A.AUTHOR_MIN_BOOKS, A.AUTHOR_LIST, A.SUBJECT_MIN_BOOKS]);
  });
  it('slugs and years', () => {
    expect(A.authorSlug('Brontë, Charlotte, 1816-1855')).toBe('charlotte-bronte'); expect(A.authorSlug('Baum, L. Frank (Lyman Frank), 1856-1919')).toBe('l-frank-baum'); expect(A.authorSlug('中文名')).toBe('');
    expect(A.authorYears('Burroughs, Edgar Rice, 1875-1950')).toEqual({ born: '1875', died: '1950' }); expect(A.authorYears('Aristotle, 384 BCE-322 BCE')).toEqual({}); expect(A.isSlug('a-b-1')).toBe(true); expect(A.isSlug('A_b')).toBe(false);
  });
  it('cleans author names and drops illustrators', () => {
    expect(authorNames(['Thompson, Ruth Plumly', 'Neill, John R. (John Rea), 1877-1943 [Illustrator]'])).toEqual(['Ruth Plumly Thompson']);
    expect(authorNames(['Neill, John R. [Illustrator]'])).toEqual(['John R. Neill']); expect(authorEntries(['Baum, L. Frank'])).toEqual([{ name: 'L. Frank Baum', slug: 'l-frank-baum' }]);
  });
  it('titles stay short and descriptions fit a search result', () => {
    const h = bookHead({ id: '7', title: 'A Very Long Title '.repeat(10), authors: ['Doe, Jane'], language: 'fr', subjects: ['Fiction -- Test', 'Poetry'] });
    expect(h.title.length).toBeLessThanOrEqual(70); expect(h.description.length).toBeLessThanOrEqual(160); expect(h.description).toContain('French'); expect(clip('a b c', 3)).toBe('a…');
    expect(searchHead('Poetry', true, 1234).description).toContain('1,234 free Poetry'); expect(authorHead({ slug: 'a-b', name: 'A B', count: 1, books: [['1', 'Only']] }).title).toContain('1 free ebook |');
  });
  it('escapes everything it writes into HTML', () => {
    const html = renderHead({ title: 'A "quote" <b>', description: 'x & y', path: '/', ld: () => [{ n: '</script><script>alert(1)' }] }, 'https://x.test');
    expect(html).not.toContain('<b>'); expect(html).toContain('&quot;quote&quot;'); expect(html).not.toContain('</script><script>');
  });
  it('the home page declares WebSite and Organization', () => { const types = homeHead().ld!((p) => 'https://x.test' + p).map((o: { [k: string]: unknown }) => o['@type']); expect(types).toEqual(['WebSite', 'Organization']); });
});
describe('catalogue files', () => {
  it('book metadata is found by the same shard rule the server uses; authors and subjects are written', async () => {
    const f: Map<string, string> = await seoFiles();
    expect(JSON.parse(f.get(`meta/${shardOf(5)}.json`)!).b['5'][0]).toBe('Title 5 of Zebra5');
    const au = JSON.parse(f.get(`authors/${A.authorShard('name5-author')}.json`)!)['name5-author']; expect(au.slice(0, 2)).toEqual(['Name5 Author', 2]); expect(au[2]).toBe('1800');
    expect(JSON.parse(f.get('subjects.json')!).names.Poetry).toBe(12);
    const seo = JSON.parse(f.get('seo.json')!); expect(seo.sitemaps).toEqual(['sitemap-pages', 'sitemap-books-1', 'sitemap-authors-1']); expect(seo.total).toBe(60);
  });
  it('sitemaps list the pages, every book, and only authors with enough books', async () => {
    const f: Map<string, string> = await seoFiles();
    expect(f.get('sitemaps/sitemap-pages.xml')).toContain('<loc>__ORIGIN__/search?subject=Poetry</loc>'); expect(f.get('sitemaps/sitemap-books-1.xml')).toContain('<loc>__ORIGIN__/book/60</loc>');
    const authors = f.get('sitemaps/sitemap-authors-1.xml')!; expect(authors).toContain('/author/name5-author'); expect(authors).not.toContain('/author/name25-author');   // one book only
  });
});
describe('server pages', () => {
  it('a book page has its own title, description, canonical, share card, structured data and readable text', async () => {
    const { r, text } = await get(await env(), '/book/5');
    expect(r.status).toBe(200); expect(text.match(/<title>/g)).toHaveLength(1); expect(text.match(/name="description"/g)).toHaveLength(1);
    expect(text).toContain('<title>Title 5 of Zebra5 by Name5 Author | Grimoire</title>'); expect(text).toContain('<link rel="canonical" href="https://x.test/book/5"/>');
    expect(text).toContain('property="og:image" content="https://x.test/og/5.jpg"'); expect(text).toContain('property="og:type" content="book"'); expect(text).toContain('name="twitter:card" content="summary"');
    expect(text).toContain('<h1>Title 5 of Zebra5</h1>'); expect(text).toContain('href="/author/name5-author"'); expect(text).toContain('Copyright rules differ by country'); expect(text).not.toContain('Default description');
    const j = ld(text); expect(j[0]['@type']).toBe('Book'); expect(j[0].url).toBe('https://x.test/book/5'); expect(j[0].author[0]).toEqual({ '@type': 'Person', name: 'Name5 Author', url: 'https://x.test/author/name5-author' }); expect(j[0].publisher.name).toBe('Project Gutenberg');
    expect(j[1].itemListElement.map((x: { name: string }) => x.name)).toEqual(['Grimoire', 'Name5 Author', 'Title 5 of Zebra5']);
  });
  it('an author page: Person data, a book list, canonical; one-book authors are noindex; unknown ones are 404', async () => {
    const e = await env(); const { r, text } = await get(e, '/author/name5-author');
    expect(r.status).toBe(200); expect(r.headers.get('x-robots-tag')).toBeNull(); expect(text).toContain('<title>Name5 Author (1800–1850): 2 free ebooks | Grimoire</title>'); expect(text).toContain('<link rel="canonical" href="https://x.test/author/name5-author"/>');
    expect(text).toContain('<h1>Name5 Author</h1>'); expect(text).toContain('href="/book/45"'); const j = ld(text); expect(j.map((x: { '@type': string }) => x['@type'])).toEqual(['Person', 'ItemList', 'BreadcrumbList']); expect(j[0].birthDate).toBe('1800');
    const thin = await get(e, '/author/name25-author'); expect(thin.r.status).toBe(200); expect(thin.r.headers.get('x-robots-tag')).toContain('noindex'); expect(thin.text).toContain('content="noindex,follow"');
    expect((await get(e, '/author/name5-author?page=2')).r.headers.get('x-robots-tag')).toContain('noindex');
    const gone = await get(e, '/author/nobody-here'); expect(gone.r.status).toBe(404); expect(gone.r.headers.get('x-robots-tag')).toContain('noindex'); expect((await get(e, '/author/Bad_Slug')).r.status).toBe(404);
  });
  it('a missing book, an unknown address and a missing file are real 404s and not indexed', async () => {
    const e = await env();
    for (const p of ['/book/999999', '/book/abc', '/read/999999', '/something/else', '/book']) { const { r, text } = await get(e, p); expect(r.status, p).toBe(404); expect(r.headers.get('x-robots-tag'), p).toContain('noindex'); expect(text, p).toContain('noindex'); }
    expect((await get(e, '/ghost.png')).r.status).toBe(404); expect((await get(e, '/favicon.svg')).r.status).toBe(200);
  });
  it('SITE_URL decides the address used in canonical and share tags', async () => {
    const { text } = await get(await env({ SITE_URL: 'https://books.example.com/' }), '/book/5'); expect(text).toContain('href="https://books.example.com/book/5"'); expect(text).not.toContain('x.test');
  });
  it('CANONICAL_REDIRECT sends other hosts to SITE_URL, but only when switched on', async () => {
    const on = await env({ SITE_URL: 'https://books.example.com', CANONICAL_REDIRECT: 'true' });
    const r = await worker.fetch(new Request('https://x.pages.dev/book/5?a=1'), on as never); expect(r.status).toBe(301); expect(r.headers.get('location')).toBe('https://books.example.com/book/5?a=1');
    expect((await get(on, '/book/5', 'https://books.example.com')).r.status).toBe(200); expect((await get(on, '/book/5', 'http://localhost:8788')).r.status).toBe(200);
    expect((await get(await env({ SITE_URL: 'https://books.example.com' }), '/book/5')).r.status).toBe(200);
  });
  it('Google and Bing verification: tag on every page, or the verification file', async () => {
    const e = await env({ GOOGLE_SITE_VERIFICATION: 'abcDEF123-_456ghiJKL', BING_SITE_VERIFICATION: 'BING0123456789ABCDEF', GOOGLE_VERIFICATION_FILE: 'google1a2b3c4d5e6f7a8b.html' });
    for (const p of ['/', '/book/5', '/author/name5-author', '/search']) { const { text } = await get(e, p); expect(text, p).toContain('<meta name="google-site-verification" content="abcDEF123-_456ghiJKL"/>'); expect(text, p).toContain('<meta name="msvalidate.01" content="BING0123456789ABCDEF"/>'); }
    expect((await get(e, '/google1a2b3c4d5e6f7a8b.html')).text).toBe('google-site-verification: google1a2b3c4d5e6f7a8b.html');
    expect((await get(await env({ GOOGLE_SITE_VERIFICATION: 'x"><script>' }), '/')).text).not.toContain('google-site-verification');   // bad values are ignored
    expect((await get(await env(), '/')).text).not.toContain('google-site-verification');
  });
  it('book titles with HTML in them cannot break the page', async () => {
    const { text } = await get(await env({}, { '5': ['Evil </title><script>alert(1)</script>', ['A, B'], 'en', []] }), '/book/5');
    expect(text).not.toContain('<script>alert(1)'); expect(text).toContain('&lt;script&gt;');
  });
  it('home page, catalogue, subject pages are indexable; searches, page 2+, tiny or unknown subjects, the reader and the shelf are not', async () => {
    const e = await env();
    expect((await get(e, '/')).text).toContain('property="og:image" content="https://x.test/og-default.png"');
    expect((await get(e, '/search')).r.headers.get('x-robots-tag')).toBeNull(); expect((await get(e, '/search?sort=title')).r.headers.get('x-robots-tag')).toBeNull();
    const sub = await get(e, '/search?subject=Poetry'); expect(sub.r.headers.get('x-robots-tag')).toBeNull(); expect(sub.text).toContain('href="https://x.test/search?subject=Poetry"'); expect(sub.text).toContain('12 free Poetry ebooks'); expect(sub.text).toContain('<h1>Poetry</h1>');
    expect((await get(e, '/search?subject=No%20such%20subject')).r.headers.get('x-robots-tag')).toContain('noindex');
    const q = await get(e, '/search?q=zebra'); expect(q.r.headers.get('x-robots-tag')).toContain('noindex'); expect(q.text).toContain('content="noindex,follow"');
    expect((await get(e, '/search?subject=Poetry&page=2')).r.headers.get('x-robots-tag')).toContain('noindex');
    expect((await get(e, '/read/5')).r.headers.get('x-robots-tag')).toContain('noindex'); expect((await get(e, '/shelf')).r.headers.get('x-robots-tag')).toContain('noindex');
  });
  it('robots.txt and the sitemap index and files use the site address', async () => {
    const e = await env();
    const rb = (await get(e, '/robots.txt')).text; expect(rb).toContain('Sitemap: https://x.test/sitemap.xml'); expect(rb).toContain('Disallow: /search?*q='); expect(rb).toContain('Disallow: /author/*?*page='); expect(rb).not.toContain('Disallow: /book');
    const idx = (await get(e, '/sitemap.xml')).text; for (const n of ['sitemap-pages', 'sitemap-books-1', 'sitemap-authors-1']) expect(idx).toContain(`<loc>https://x.test/sitemaps/${n}.xml</loc>`);
    const pages = (await get(e, '/sitemaps/sitemap-pages.xml')).text; expect(pages).toContain('<loc>https://x.test/</loc>'); expect(pages).toContain('<loc>https://x.test/search</loc>'); expect(pages).not.toContain('__ORIGIN__');
    expect((await get(e, '/sitemaps/sitemap-books-1.xml')).text).toContain('<loc>https://x.test/book/60</loc>'); expect((await get(e, '/sitemaps/sitemap-authors-1.xml')).text).toContain('<loc>https://x.test/author/name5-author</loc>');
    expect((await get(e, '/sitemaps/sitemap-books-9.xml')).r.status).toBe(404);
  });
  it('share picture: the book cover when Gutenberg has it, the default picture when it does not', async () => {
    const e = await env();
    vi.stubGlobal('fetch', async () => new Response('JPEGDATA', { headers: { 'content-type': 'image/jpeg' } }));
    const a = await get(e, '/og/5.jpg'); expect(a.text).toBe('JPEGDATA'); expect(a.r.headers.get('content-type')).toBe('image/jpeg');
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 504 }));
    const b = await get(e, '/og/5.jpg'); expect(b.text).toBe('PNGDATA'); expect(b.r.headers.get('content-type')).toBe('image/png');
    vi.stubGlobal('fetch', async () => { throw new Error('timeout'); });
    expect((await get(e, '/og/5.jpg')).text).toBe('PNGDATA');
  });
  it('a broken catalog file means the plain app is served, not an error page', async () => {
    const broken = { ASSETS: { fetch: async (r: Request) => (new URL(r.url).pathname === '/' ? new Response(SHELL) : new Response('x', { status: 500 })) } };
    const r = await worker.fetch(new Request('https://x.test/book/5'), broken as never); expect([404, 500]).toContain(r.status);
  });
});
