import type { AccessStatus } from './types';
import { isAccessStatus } from './access';
export const PAGE_SIZE = 24; // hard ceiling is 50
export const MAX_PAGE_SIZE = 50;
export const SORTS = ['relevance', 'title', 'year_desc', 'year_asc', 'recent'] as const;
export type Sort = (typeof SORTS)[number];
export interface SearchParams { q: string; subject: string; language: string; yearFrom?: number; yearTo?: number; access?: AccessStatus; sort: Sort; page: number }
const int = (v: string | null, min: number, max: number) => {
  if (v === null || !/^\d{1,5}$/.test(v)) return undefined;
  const n = Number(v); return n >= min && n <= max ? n : undefined;
};
/** Turns untrusted URL parameters into a safe, bounded search request. */
export function parseParams(sp: URLSearchParams): SearchParams {
  const q = (sp.get('q') ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  const subject = (sp.get('subject') ?? '').trim().slice(0, 80);
  const lang = (sp.get('language') ?? '').toLowerCase();
  const access = sp.get('access') ?? '';
  const sort = (sp.get('sort') ?? '') as Sort;
  let yearFrom = int(sp.get('from'), 1000, 2100), yearTo = int(sp.get('to'), 1000, 2100);
  if (yearFrom && yearTo && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  return {
    q, subject, language: /^[a-z]{2,3}$/.test(lang) ? lang : '', yearFrom, yearTo,
    access: isAccessStatus(access) ? access : undefined,
    sort: SORTS.includes(sort) ? sort : q ? 'relevance' : 'title',
    page: int(sp.get('page'), 1, 1000) ?? 1,
  };
}
/** A search with no text and no filters is not run; the page shows browse suggestions instead. */
export const hasCriteria = (p: SearchParams) => !!(p.q || p.subject || p.language || p.yearFrom || p.yearTo || p.access);
