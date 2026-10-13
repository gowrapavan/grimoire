// Cloudflare Pages "advanced mode" worker (built to dist/_worker.js by `npm run build:worker`).
// It answers every page address (public/_routes.json leaves images, scripts and catalog files to the static host):
//  - /, /book/<id>, /author/<name>, /search, /read/<id>, /shelf : the normal app page, with the right title, description, canonical address,
//    share-card tags and structured data already in the first HTML, so Google and link previews (WhatsApp, Facebook, X, Telegram...) see them
//    without running JavaScript. Book, author and subject pages also carry their main facts as plain text.
//  - Real HTTP status codes: a book, author or reader address that does not exist, and any unknown address, returns 404 (and noindex),
//    not an empty page with 200. Pages that should not be in search results (text searches, page 2 and up, the reader, the shelf,
//    authors with one book, subjects with few books) are marked noindex.
//  - /og/<id>.jpg   : the book's cover from Project Gutenberg, served from this site (or a default picture), used as the share picture.
//  - /robots.txt, /sitemap.xml, /sitemaps/sitemap-*.xml : made with the site's own address.
//  - Optional settings (Cloudflare Pages > Settings > Variables): SITE_URL, GOOGLE_SITE_VERIFICATION, GOOGLE_VERIFICATION_FILE,
//    BING_SITE_VERIFICATION, CANONICAL_REDIRECT.
// If anything goes wrong while building a page, the plain app is served, so the site never breaks because of this file.
import { authorEntries, authorHead, bookHead, esc, homeHead, notFoundHead, readHead, renderHead, searchHead, shardOf, shelfHead, yearsText, type BookInfo, type Head } from "../src/lib/seoText.ts";
import { AUTHOR_MIN_BOOKS, authorFromRow, authorPath, authorShard, isSlug, type AuthorInfo } from '../src/lib/authors';
import { LANGUAGES } from '../src/lib/languages';

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  SITE_URL?: string;                 // https://www.yourdomain.com : used in canonical addresses, share tags and sitemaps
  GOOGLE_SITE_VERIFICATION?: string; // the content value of Google Search Console's HTML tag
  GOOGLE_VERIFICATION_FILE?: string; // or the file name Search Console gives you, for example google1a2b3c4d5e6f.html
  BING_SITE_VERIFICATION?: string;   // Bing Webmaster Tools tag value
  CANONICAL_REDIRECT?: string;       // "true": send other addresses (for example *.pages.dev) to SITE_URL with a 301
}
type BookRow = [string, string[], string, string[]];
type AuthorRow = Parameters<typeof authorFromRow>[1];

// Small files are kept while this worker instance lives (one cache per deployment), so repeat visits skip the file read.
const memo = new WeakMap<object, Map<string, Promise<unknown>>>();
function cached<T>(env: Env, key: string, make: () => Promise<T | null>): Promise<T | null> {
  let m = memo.get(env); if (!m) { m = new Map(); memo.set(env, m); }
  let p = m.get(key) as Promise<T | null> | undefined;
  if (!p) {
    p = make().catch(() => null);
    if (m.size > 90) m.delete(m.keys().next().value as string);
    m.set(key, p); const mine = m; p.then((v) => { if (v === null && mine.get(key) === p) mine.delete(key); });   // do not remember a failed read
  }
  return p;
}
async function readJson<T>(env: Env, base: URL, path: string): Promise<T | null> {
  const r = await env.ASSETS.fetch(new Request(new URL(path, base))); return r.ok ? ((await r.json()) as T) : null;
}
async function getBook(env: Env, base: URL, id: string): Promise<BookInfo | null> {
  if (!/^\d{1,9}$/.test(id)) return null;
  const sh = await cached(env, `b${shardOf(id)}`, async () => (await readJson<{ b?: Record<string, BookRow> }>(env, base, `/catalog/meta/${shardOf(id)}.json`))?.b ?? null);
  const row = sh?.[id]; return row ? { id, title: row[0], authors: row[1], language: row[2], subjects: row[3] } : null;
}
async function getAuthor(env: Env, base: URL, slug: string): Promise<AuthorInfo | null> {
  if (!isSlug(slug)) return null;
  const n = authorShard(slug);
  const sh = await cached(env, `a${n}`, () => readJson<Record<string, AuthorRow>>(env, base, `/catalog/authors/${n}.json`));
  const row = sh?.[slug]; return row ? authorFromRow(slug, row) : null;
}
const getSubjects = (env: Env, base: URL) => cached(env, 'subjects', () => readJson<{ min: number; names: Record<string, number> }>(env, base, '/catalog/subjects.json'));

const siteUrl = (env: Env): URL | null => { const s = (env.SITE_URL ?? '').trim().replace(/\/+$/, ''); try { return /^https?:\/\/[^\s/]+$/i.test(s) ? new URL(s) : null; } catch { return null; } };
const siteOrigin = (env: Env, url: URL) => siteUrl(env)?.origin ?? url.origin;
const token = (v?: string) => (v && /^[\w.-]{10,120}$/.test(v.trim()) ? v.trim() : '');
const verifyTags = (env: Env) => [token(env.GOOGLE_SITE_VERIFICATION) && `<meta name="google-site-verification" content="${esc(token(env.GOOGLE_SITE_VERIFICATION))}"/>`, token(env.BING_SITE_VERIFICATION) && `<meta name="msvalidate.01" content="${esc(token(env.BING_SITE_VERIFICATION))}"/>`].filter(Boolean).join('\n');

async function shell(env: Env, url: URL): Promise<string> {
  const r = await env.ASSETS.fetch(new Request(new URL('/', url)));
  if (!r.ok) throw new Error('no app shell');
  return r.text();
}
/** Puts the page's tags into the app's HTML (replacing the default ones) and, optionally, readable text inside the empty app container. */
function compose(html: string, head: Head, origin: string, env: Env, body = ''): string {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+name="description"[^>]*>/gi, '').replace(/<meta\s+name="robots"[^>]*>/gi, '').replace(/<link\s+rel="canonical"[^>]*>/gi, '');
  out = out.replace('</head>', () => renderHead(head, origin) + (verifyTags(env) ? '\n' + verifyTags(env) : '') + '\n</head>');
  if (body) out = out.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);   // the app replaces this as soon as it starts
  return out;
}
const page = (html: string, status = 200, noindex = false) => new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', ...(noindex ? { 'x-robots-tag': 'noindex, follow' } : {}) } });
const wrap = (inner: string) => `<main data-prerender="1" style="max-width:46rem;margin:0 auto;padding:1.5rem 1rem">${inner}<p><a href="/">Biblorya: free classic books</a></p></main>`;
const link = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`;

function bookBody(b: BookInfo): string {
  const people = authorEntries(b.authors); const lang = LANGUAGES[b.language];
  return wrap(`<article><h1>${esc(b.title)}</h1>`
    + (people.length ? `<p>by ${people.map((p) => (p.slug ? link(authorPath(p.slug), p.name) : esc(p.name))).join('; ')}</p>` : '')
    + (lang ? `<p>Language: ${esc(lang)}</p>` : '')
    + (b.subjects.length ? `<p>Subjects: ${b.subjects.map((s) => link(`/search?subject=${encodeURIComponent(s)}`, s)).join('; ')}</p>` : '')
    + `<p>${link(`/read/${b.id}`, `Read ${b.title} online`)} · <a href="https://www.gutenberg.org/ebooks/${b.id}" rel="noopener">View on Project Gutenberg</a></p>`
    + `<p>Free to read according to Project Gutenberg. Copyright rules differ by country, so check the source page before reusing a text.</p></article>`);
}
function authorBody(a: AuthorInfo): string {
  const y = yearsText(a);
  return wrap(`<article><h1>${esc(a.name)}</h1>${y ? `<p>${esc(y)}</p>` : ''}<p>${a.count} free ebook${a.count === 1 ? '' : 's'} by ${esc(a.name)} in the Project Gutenberg catalogue.</p>`
    + `<ul>${a.books.map(([id, t]) => `<li>${link(`/book/${id}`, t.replace(/\s+/g, ' '))}</li>`).join('')}</ul>${a.count > a.books.length ? `<p>${link(`/search?q=${encodeURIComponent(a.name)}`, `Search all books by ${a.name}`)}</p>` : ''}</article>`);
}
const homeBody = () => wrap(`<h1>Biblorya</h1><p>${esc(homeHead().description)}</p><p>${link('/search?sort=title', 'Browse all books')}</p>`);
const notFoundBody = () => wrap('<h1>Page not found</h1><p>This address does not match a book, author or page on Biblorya.</p>');

async function cover(env: Env, url: URL, id: string): Promise<Response> {
  try {
    const r = await fetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`, { signal: AbortSignal.timeout(5000) });
    const type = r.headers.get('content-type') ?? '';
    if (r.ok && type.startsWith('image/')) return new Response(r.body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400, s-maxage=604800' } });
  } catch { /* fall through to the default picture */ }
  const d = await env.ASSETS.fetch(new Request(new URL('/og-default.png', url)));
  return new Response(d.body, { status: d.status, headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' } });
}

async function sitemapIndex(env: Env, url: URL, origin: string): Promise<Response> {
  const j = await readJson<{ sitemaps?: string[]; generated?: string }>(env, url, '/catalog/seo.json');
  if (!j?.sitemaps?.length) return new Response('Sitemap not built yet. Run "npm run build:catalog".', { status: 404 });
  const last = /^\d{4}-\d{2}-\d{2}/.test(j.generated ?? '') ? `<lastmod>${j.generated!.slice(0, 10)}</lastmod>` : '';
  const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
  const items = j.sitemaps.filter((n) => /^sitemap-(?:pages|books-\d{1,3}|authors-\d{1,3})$/.test(n)).map((n) => `<sitemap><loc>${xmlEscape(`${origin}/sitemaps/${n}.xml`)}</loc>${last}</sitemap>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
async function sitemapFile(env: Env, url: URL, origin: string, name: string): Promise<Response> {
  const r = await env.ASSETS.fetch(new Request(new URL(`/catalog/sitemaps/${name}.xml`, url)));
  if (!r.ok) return new Response('Not found', { status: 404 });
  return new Response((await r.text()).split('__ORIGIN__').join(origin), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
const robots = (origin: string) => new Response(['User-agent: *', 'Allow: /', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
    const url = new URL(request.url); const path = url.pathname.replace(/\/+$/, '') || '/'; const origin = siteOrigin(env, url);
    try {
      // One main address: other addresses (for example the *.pages.dev one) are sent to SITE_URL. Off unless CANONICAL_REDIRECT=true.
      const site = siteUrl(env);
      if (site && /^(1|true|yes|on)$/i.test(env.CANONICAL_REDIRECT ?? '') && url.hostname !== site.hostname && !/^(localhost|127\.|\[::1\])/.test(url.hostname)) return Response.redirect(site.origin + url.pathname + url.search, 301);
      const vf = (env.GOOGLE_VERIFICATION_FILE ?? '').trim();
      if (/^google[a-z0-9]{8,64}\.html$/i.test(vf) && path === '/' + vf) return new Response(`google-site-verification: ${vf}`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      if (path === '/robots.txt') return robots(origin);
      if (path === '/sitemap.xml') return await sitemapIndex(env, url, origin);
      let m = /^\/sitemaps\/(sitemap-(?:pages|books-\d{1,3}|authors-\d{1,3}))\.xml$/.exec(path); if (m) return await sitemapFile(env, url, origin, m[1]);
      m = /^\/og\/(\d{1,9})(?:\.jpg)?$/.exec(path); if (m) return await cover(env, url, m[1]);
      if (/\.[a-z0-9]{1,8}$/i.test(path)) {   // a file: serve it, and never answer a missing file with the app page and a 200
        const r = await env.ASSETS.fetch(request);
        return (r.headers.get('content-type') ?? '').includes('text/html') && !/\.html?$/i.test(path) ? new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }) : r;
      }
      const missing = async () => page(compose(await shell(env, url), notFoundHead(), origin, env, notFoundBody()), 404, true);

      if (path === '/') return page(compose(await shell(env, url), homeHead(), origin, env, homeBody()));
      m = /^\/book\/([^/]+)$/.exec(path);
      if (m) { const b = await getBook(env, url, decodeURIComponent(m[1])); return b ? page(compose(await shell(env, url), bookHead(b), origin, env, bookBody(b))) : missing(); }
      m = /^\/author\/([^/]+)$/.exec(path);
      if (m) {
        const a = await getAuthor(env, url, decodeURIComponent(m[1])); if (!a) return missing();
        const indexable = a.count >= AUTHOR_MIN_BOOKS && !url.searchParams.has('page');   // one-book authors and page 2 and up are thin
        return page(compose(await shell(env, url), authorHead(a, indexable), origin, env, authorBody(a)), 200, !indexable);
      }
      m = /^\/read\/([^/]+)$/.exec(path);
      if (m) { const b = await getBook(env, url, decodeURIComponent(m[1])); return b ? page(compose(await shell(env, url), readHead(b.title), origin, env), 200, true) : missing(); }
      if (path === '/shelf') return page(compose(await shell(env, url), shelfHead(), origin, env), 200, true);
      if (path === '/search') {
        const p = url.searchParams; const subject = (p.get('subject') ?? '').trim().slice(0, 80);
        let indexable = !['q', 'page', 'language', 'from', 'to', 'access'].some((k) => p.has(k));   // text searches and page 2, 3... are not worth indexing
        let count: number | undefined;
        if (subject) { count = (await getSubjects(env, url))?.names[subject]; if (!count) indexable = false; }   // unknown or tiny subjects stay out of search results
        const body = subject ? wrap(`<h1>${esc(subject)}</h1><p>${count ? `${count.toLocaleString('en-US')} free ebooks` : 'Free ebooks'} on this subject from Project Gutenberg.</p>`) : wrap('<h1>Browse the catalogue</h1><p>Free classic books from Project Gutenberg. Pick a subject or search by title or author.</p>');
        return page(compose(await shell(env, url), searchHead(subject, indexable, count), origin, env, body), 200, !indexable);
      }
      return await missing();   // not a page of this site: a real 404, not the app page with a 200
    } catch { /* fall back to the plain app below */ }
    return env.ASSETS.fetch(request);
  },
};
