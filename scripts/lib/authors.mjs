// Copy of src/lib/authors.ts (+ authorParts from src/lib/openlibrary.ts) for the catalogue build, which runs in plain Node.
// tests/seo.test.ts checks that both give the same answers. Change them together.
export const AUTHOR_SHARDS = 64;
export const AUTHOR_MIN_BOOKS = 2;
export const AUTHOR_LIST = 40;
export const SUBJECT_MIN_BOOKS = 10;
export function authorParts(raw) {
  const clean = raw.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/,?\s*\d{3,4}\??\s*-\s*\d{0,4}\??/g, '').replace(/\s+/g, ' ').trim();
  const [last, ...rest] = clean.split(',').map((x) => x.trim()).filter(Boolean);
  return { full: rest.length ? `${rest.join(' ')} ${last}` : last ?? '', last: last ?? '' };
}
export const slugify = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
export const authorSlug = (raw) => slugify(authorParts(raw).full);
export function authorYears(raw) {
  const m = /(\d{3,4})\??\s*-\s*(\d{3,4})?\??/.exec(raw.replace(/\[[^\]]*\]/g, ''));
  return m ? { born: m[1], ...(m[2] ? { died: m[2] } : {}) } : {};
}
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export const authorShard = (slug) => fnv(slug) % AUTHOR_SHARDS;
export const authorName = (raw) => authorParts(raw).full;
