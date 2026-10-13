// Optional extras for the book page, looked up live from Open Library (openlibrary.org).
// Nothing is stored. If there is no confident match, or the request fails, the page simply shows nothing extra.
export interface OlExtra { workUrl: string; year?: number; description?: string; author?: { name: string; bio?: string; born?: string; died?: string; url: string } }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(the|a|an) /, '');
/** "Jefferson, Thomas" -> { full: "Thomas Jefferson", last: "Jefferson" }. Dates and brackets are dropped. */
export function authorParts(raw: string) {
  const clean = raw.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/,?\s*\d{3,4}\??\s*-\s*\d{0,4}\??/g, '').replace(/\s+/g, ' ').trim();
  const [last, ...rest] = clean.split(',').map((x) => x.trim()).filter(Boolean);
  return { full: rest.length ? `${rest.join(' ')} ${last}` : last ?? '', last: last ?? '' };
}
export const searchTitle = (t: string) => t.split(/[\n:;]/)[0].replace(/\s+/g, ' ').trim().slice(0, 90);
interface Doc { key: string; title?: string; author_name?: string[]; author_key?: string[]; first_publish_year?: number }
/** Accept a result only if its title matches and (when we know the author) the author's surname matches. */
export function pickMatch(docs: Doc[], title: string, authorRaw?: string): Doc | undefined {
  const t = norm(searchTitle(title)); if (t.length < 3) return undefined;
  const last = authorRaw ? norm(authorParts(authorRaw).last) : '';
  return docs.find((d) => {
    const dt = norm(d.title ?? ''); if (!dt || !(dt === t || dt.startsWith(t + ' ') || t.startsWith(dt + ' '))) return false;
    return !last || (d.author_name ?? []).some((a) => norm(a).includes(last));
  });
}
/** Open Library text can be a string or { value }. Cut it before "----" extras, unwrap [links](url), keep it short. */
export function cleanText(v: unknown, max = 1200): string | undefined {
  const raw = typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { value?: unknown }).value === 'string' ? (v as { value: string }).value : '';
  const noHtml = raw.replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let s = noHtml.split(/\r?\n\s*-{3,}/)[0].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\[\d*\]/g, '$1').replace(/[*_`#>]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return s.length >= 20 ? s : undefined;
}

const cache = new Map<string, Promise<OlExtra | null>>();
async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<T>;
}
export function lookupOpenLibrary(id: string, title: string, authorRaw?: string): Promise<OlExtra | null> {
  const hit = cache.get(id); if (hit) return hit;
  const run = async (): Promise<OlExtra | null> => {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      // Try the full author name first, then just the surname (Open Library often has "A. C. Bos"), then the title alone.
      // Every candidate still has to pass pickMatch, so a looser search never lets in a wrong book.
      const parts = authorRaw ? authorParts(authorRaw) : null;
      const tries: (string | null)[] = parts ? [parts.full, parts.last, null] : [null];
      let doc: Doc | undefined;
      for (const au of [...new Set(tries)]) {
        const q = new URLSearchParams({ title: searchTitle(title), limit: '10', fields: 'key,title,author_name,author_key,first_publish_year' });
        if (au) q.set('author', au);
        const res = await getJson<{ docs?: Doc[] }>(`https://openlibrary.org/search.json?${q}`, ctl.signal).catch(() => ({ docs: [] as Doc[] }));
        doc = pickMatch(res.docs ?? [], title, authorRaw);
        if (doc) break;
      }
      if (!doc || !/^\/works\/OL\d+W$/.test(doc.key)) return null;
      const akey = doc.author_key?.[0] && /^OL\d+A$/.test(doc.author_key[0]) ? doc.author_key[0] : '';
      const [work, au] = await Promise.all([
        getJson<{ description?: unknown }>(`https://openlibrary.org${doc.key}.json`, ctl.signal).catch(() => ({} as { description?: unknown })),
        akey ? getJson<{ name?: string; bio?: unknown; birth_date?: string; death_date?: string }>(`https://openlibrary.org/authors/${akey}.json`, ctl.signal).catch(() => null) : Promise.resolve(null),
      ]);
      const out: OlExtra = { workUrl: `https://openlibrary.org${doc.key}`, year: doc.first_publish_year, description: cleanText(work.description) };
      if (au?.name) out.author = { name: au.name, bio: cleanText(au.bio, 600), born: au.birth_date, died: au.death_date, url: `https://openlibrary.org/authors/${akey}` };
      return out.year || out.description || out.author ? out : null;
    } catch { return null; } finally { clearTimeout(timer); }
  };
  const p = run(); cache.set(id, p); return p;
}
