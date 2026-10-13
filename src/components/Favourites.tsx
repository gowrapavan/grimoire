import { useEffect, useRef, useState } from 'react';
import { BookCard, EmptyState, Loading, Rail } from './ui';
import { catalog } from '../lib/catalog';
import { parseParams } from '../lib/params';
import type { Book } from '../lib/types';
// Hand-picked reader favourites. Each tab runs a few title/author searches and mixes the results.
// This is a curated list, not a download ranking: the catalogue has no popularity numbers.
const THEMES: { id: string; label: string; queries: [string, number][] }[] = [
  { id: 'royal', label: 'Kings & queens', queries: [['king', 6], ['queen', 6], ['prince', 2], ['princess', 2]] },
  { id: 'tarzan', label: 'Tarzan & the jungle', queries: [['tarzan', 9], ['jungle book', 2], ['jungle', 3]] },
  { id: 'fairy', label: 'Fairy tales & storybooks', queries: [['alice wonderland', 1], ['peter pan', 1], ['wizard oz', 1], ['pinocchio', 1], ['cinderella', 1], ['snow white', 1], ['beauty beast', 1], ['little mermaid', 1], ['aladdin', 1], ['grimm fairy', 1], ['andersen fairy', 1], ['sleeping beauty', 1]] },
  { id: 'pirates', label: 'Pirates & adventure', queries: [['treasure island', 1], ['pirate', 4], ['robinson crusoe', 1], ['swiss family robinson', 1], ['captain', 3], ['moby dick', 1], ['treasure', 2]] },
  { id: 'mystery', label: 'Sherlock & mystery', queries: [['sherlock holmes', 6], ['father brown', 2], ['arsene lupin', 2], ['mystery', 3]] },
];
async function load(queries: [string, number][]): Promise<Book[]> {
  const lists = await Promise.all(queries.map(async ([q, n]) => {
    try { return (await catalog.search({ ...parseParams(new URLSearchParams({ q })), sort: 'relevance' })).items.slice(0, n); } catch { return []; }
  }));
  const out: Book[] = [], seen = new Set<string>();
  for (let i = 0; out.length < 12 && lists.some((l) => i < l.length); i++)  // take one from each query in turn, so the tab is a mix
    for (const l of lists) { const b = l[i]; if (b && !seen.has(b.id) && out.length < 12) { seen.add(b.id); out.push(b); } }
  return out;
}
export function Favourites() {
  const [tab, setTab] = useState(THEMES[0].id);
  const [data, setData] = useState<Record<string, Book[] | 'loading'>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (asked.current.has(tab)) return; asked.current.add(tab);
    setData((d) => ({ ...d, [tab]: 'loading' }));
    load(THEMES.find((t) => t.id === tab)!.queries).then((b) => setData((d) => ({ ...d, [tab]: b })));
  }, [tab]);
  const cur = data[tab];
  const onKey = (e: React.KeyboardEvent) => {
    const i = THEMES.findIndex((t) => t.id === tab); let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % THEMES.length; if (e.key === 'ArrowLeft') n = (i - 1 + THEMES.length) % THEMES.length;
    if (n >= 0) { e.preventDefault(); setTab(THEMES[n].id); document.getElementById(`fav-t-${THEMES[n].id}`)?.focus(); }
  };
  return (
    <section aria-labelledby="fav">
      <h2 id="fav" className="text-2xl text-oxblood sm:text-3xl">Reader favourites</h2>
      <div className="mb-3 mt-1 border-t-4 border-double border-line" />
      <p className="mb-3 italic text-muted">Classic stories people love to start with. Pick a kind of story.</p>
      <div role="tablist" aria-label="Kinds of stories" onKeyDown={onKey} className="mb-4 flex flex-wrap gap-2">
        {THEMES.map((t) => <button key={t.id} id={`fav-t-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls="fav-panel" tabIndex={tab === t.id ? 0 : -1} className="chip" aria-pressed={undefined} data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div id="fav-panel" role="tabpanel" aria-labelledby={`fav-t-${tab}`}>
        {(!cur || cur === 'loading') && <Loading label="Loading books" />}
        {cur && cur !== 'loading' && (cur.length
          ? <Rail label={THEMES.find((t) => t.id === tab)!.label}>{cur.map((b) => <div role="listitem" key={b.id}><BookCard book={b} /></div>)}</Rail>
          : <EmptyState title="No books found for this one yet">Try another kind of story.</EmptyState>)}
      </div>
    </section>
  );
}
