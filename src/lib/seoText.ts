// Everything about page titles, descriptions, share cards (Open Graph / Twitter) and structured data.
// Plain functions with no browser code, so the same text is made in the browser (useSeo.ts) and on the server (worker/index.ts).
import { authorParts } from './openlibrary';
import { LANGUAGES } from './languages';
import { authorName, authorPath, authorSlug, type AuthorInfo } from './authors';

export const SITE = 'Grimoire';
export const META_SHARD = 500;               // books per small metadata file (scripts/lib/seo-files.mjs uses the same number)
export const shardOf = (id: number | string) => Math.floor(Number(id) / META_SHARD);

export type Abs = (path: string) => string;
export interface Head {
  title: string; description: string;
  /** Path (with query) of the canonical address, for example /book/12 */
  path: string;
  /** Path or full URL of the share picture. */
  image?: string; imageAlt?: string; largeCard?: boolean;
  type?: 'website' | 'book' | 'profile'; tags?: string[];
  /** "index,follow" (default) or for example "noindex,follow". */
  robots?: string;
  ld?: (abs: Abs) => object[];
}
/** What the catalogue knows about one book (the same shape the server reads from its small metadata files). */
export interface BookInfo { id: string; title: string; authors: string[]; language: string; subjects: string[] }

export const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const cut = t.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,;:\-–—\s]+$/, ''); return /[.!?]$/.test(cut) ? cut : cut + '…'; };
const cleanTitle = (t: string) => t.replace(/\s+/g, ' ').replace(/\s*[\r\n]+\s*/g, ' ').trim();
const ROLE = /\[(illustrator|translator|editor|contributor|compiler|other|photographer|commentator|writer of introduction|annotator)[^\]]*\]/i;
/** The people who wrote the book (illustrators and other roles are left out), each with the address of their page. */
export function authorEntries(raw: string[]): { name: string; slug: string }[] {
  const main = raw.filter((a) => !ROLE.test(a)); const seen = new Set<string>(); const out: { name: string; slug: string }[] = [];
  for (const a of main.length ? main : raw) { const name = authorName(a); if (!name || seen.has(name)) continue; seen.add(name); out.push({ name, slug: authorSlug(a) }); }
  return out;
}
export const authorNames = (raw: string[]): string[] => authorEntries(raw).map((e) => e.name);
export const bookPath = (id: string) => `/book/${encodeURIComponent(id)}`;
export const coverImagePath = (id: string) => `/og/${encodeURIComponent(id)}.jpg`;
const GUTENBERG = { '@type': 'Organization', name: 'Project Gutenberg', url: 'https://www.gutenberg.org/' };
export const yearsText = (a: { born?: string; died?: string }) => (a.born ? (a.died ? `${a.born}–${a.died}` : `born ${a.born}`) : '');

export function bookHead(b: BookInfo): Head {
  const title = cleanTitle(b.title); const people = authorEntries(b.authors); const names = people.map((p) => p.name); const by = names.length ? ` by ${names.slice(0, 2).join(' and ')}` : '';
  const lang = LANGUAGES[b.language]; const subs = b.subjects.slice(0, 3).map((s) => s.replace(/\s*--\s*/g, ', '));
  const desc = clip(`Read ${clip(title, 70)}${by} free online. A free ebook from Project Gutenberg${lang && lang !== 'English' ? `, in ${lang}` : ''}. Read in your browser or download EPUB and Kindle.${subs.length ? ` Subjects: ${subs.join('; ')}.` : ''}`, 158);
  const first = people.find((p) => p.slug);
  return {
    title: `${clip(title + by, 54)} | ${SITE}`, description: desc, path: bookPath(b.id), type: 'book', tags: b.subjects.slice(0, 6),
    image: coverImagePath(b.id), imageAlt: `Cover of ${title}`,
    ld: (abs) => [
      { '@context': 'https://schema.org', '@type': 'Book', name: title, url: abs(bookPath(b.id)), image: abs(coverImagePath(b.id)), description: desc, inLanguage: b.language || undefined,
        author: people.slice(0, 3).map((p) => ({ '@type': 'Person', name: p.name, ...(p.slug ? { url: abs(authorPath(p.slug)) } : {}) })), keywords: b.subjects.slice(0, 8).join(', ') || undefined,
        isAccessibleForFree: true, publisher: GUTENBERG, sameAs: `https://www.gutenberg.org/ebooks/${b.id}`,
        workExample: { '@type': 'Book', bookFormat: 'https://schema.org/EBook', url: abs(bookPath(b.id)), potentialAction: { '@type': 'ReadAction', target: abs(`/read/${encodeURIComponent(b.id)}`) } } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE, item: abs('/') },
        ...(first ? [{ '@type': 'ListItem', position: 2, name: first.name, item: abs(authorPath(first.slug)) }] : []),
        { '@type': 'ListItem', position: first ? 3 : 2, name: clip(title, 80), item: abs(bookPath(b.id)) }] },
    ],
  };
}
export function authorHead(a: AuthorInfo, indexable = true): Head {
  const yrs = yearsText(a); const y = yrs ? ` (${yrs})` : ''; const n = a.count;
  const top = a.books.slice(0, 3).map(([, t]) => clip(t.split(/[:;\n]/)[0], 40));
  return {
    title: `${clip(a.name, 40)}${y}: ${n} free ebook${n === 1 ? '' : 's'} | ${SITE}`,
    description: clip(`Read ${n} free ebook${n === 1 ? '' : 's'} by ${a.name}${y} online, or download EPUB and Kindle editions from Project Gutenberg.${top.length ? ` Includes ${top.join(', ')}.` : ''}`, 158),
    path: authorPath(a.slug), image: a.books[0] ? coverImagePath(a.books[0][0]) : '/og-default.png', imageAlt: `Books by ${a.name}`, robots: indexable ? undefined : 'noindex,follow',
    ld: (abs) => [
      { '@context': 'https://schema.org', '@type': 'Person', name: a.name, url: abs(authorPath(a.slug)), ...(a.born ? { birthDate: a.born } : {}), ...(a.died ? { deathDate: a.died } : {}) },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: `Books by ${a.name}`, numberOfItems: a.count, itemListElement: a.books.slice(0, 30).map(([id, t], i) => ({ '@type': 'ListItem', position: i + 1, url: abs(bookPath(id)), name: clip(t, 100) })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE, item: abs('/') }, { '@type': 'ListItem', position: 2, name: a.name, item: abs(authorPath(a.slug)) }] },
    ],
  };
}
export const homeHead = (): Head => ({
  title: `${SITE}: free classic books to read online`, path: '/', largeCard: true, type: 'website', image: '/og-default.png', imageAlt: `${SITE}: free classic books from Project Gutenberg`,
  description: 'Search tens of thousands of free classic books from Project Gutenberg. Read them in your browser or download EPUB and Kindle files. No sign-up.',
  ld: (abs) => [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: abs('/'), inLanguage: 'en', potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: abs('/search') + '?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'Organization', name: SITE, url: abs('/'), logo: abs('/icon-512.png') },
  ],
});
/** The catalogue page and subject pages. `count` is the real number of books, when known. */
export const searchHead = (subject = '', indexable = true, count?: number): Head => subject
  ? { title: `${clip(subject, 46)}: free ebooks to read online | ${SITE}`, description: clip(`${count ? `${count.toLocaleString('en-US')} free` : 'Free'} ${subject} ebooks from Project Gutenberg. Read online in your browser or download EPUB and Kindle editions.`, 158), path: `/search?subject=${encodeURIComponent(subject)}`, image: '/og-default.png', largeCard: true, robots: indexable ? undefined : 'noindex,follow',
      ld: (abs) => [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: SITE, item: abs('/') }, { '@type': 'ListItem', position: 2, name: 'Browse the catalogue', item: abs('/search') }, { '@type': 'ListItem', position: 3, name: subject, item: abs(`/search?subject=${encodeURIComponent(subject)}`) }] }] }
  : { title: `Browse the catalogue: free classic ebooks | ${SITE}`, description: 'Browse and search free classic books from Project Gutenberg by title, author, subject or language. Read online or download EPUB and Kindle files.', path: '/search', image: '/og-default.png', largeCard: true, robots: indexable ? undefined : 'noindex,follow' };
export const readHead = (title?: string): Head => ({ title: `Read ${clip(title ?? 'a book', 54)} | ${SITE}`, description: `Read ${title ?? 'this book'} in your browser.`, path: '/', robots: 'noindex,follow' });
export const shelfHead = (): Head => ({ title: `My shelf | ${SITE}`, description: 'Books you saved on this device.', path: '/shelf', robots: 'noindex,follow' });
export const notFoundHead = (): Head => ({ title: `Page not found | ${SITE}`, description: 'This page could not be found.', path: '/', robots: 'noindex,follow' });

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const absUrl = (origin: string): Abs => (p) => (/^https?:\/\//i.test(p) ? p : origin + (p.startsWith('/') ? p : '/' + p));

/** The tags for one page, as plain data. */
export function headTags(h: Head, origin: string) {
  const abs = absUrl(origin); const url = abs(h.path); const img = h.image ? abs(h.image) : '';
  const metas: ['name' | 'property', string, string][] = [
    ['name', 'description', h.description], ['name', 'robots', h.robots ?? 'index,follow,max-image-preview:large,max-snippet:-1'],
    ['property', 'og:site_name', SITE], ['property', 'og:type', h.type ?? 'website'], ['property', 'og:title', h.title], ['property', 'og:description', h.description], ['property', 'og:url', url], ['property', 'og:locale', 'en_US'],
    ['name', 'twitter:card', img ? (h.largeCard ? 'summary_large_image' : 'summary') : 'summary'], ['name', 'twitter:title', h.title], ['name', 'twitter:description', h.description],
  ];
  if (img) { metas.push(['property', 'og:image', img], ['property', 'og:image:alt', h.imageAlt ?? h.title], ['name', 'twitter:image', img], ['name', 'twitter:image:alt', h.imageAlt ?? h.title]);
    if (h.largeCard) metas.push(['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630']); }
  for (const t of h.tags ?? []) metas.push(['property', 'book:tag', t]);
  const ld = h.ld ? JSON.stringify(h.ld(abs)).replace(/</g, '\\u003c') : '';
  return { title: h.title, canonical: url, metas, ld };
}
/** The same tags as HTML text, for the server. */
export function renderHead(h: Head, origin: string): string {
  const t = headTags(h, origin);
  return `<title>${esc(t.title)}</title>\n<link rel="canonical" href="${esc(t.canonical)}"/>\n` + t.metas.map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}"/>`).join('\n') + (t.ld ? `\n<script type="application/ld+json" id="grimoire-ld">${t.ld}</script>` : '');
}
