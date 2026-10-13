import { describe, it, expect } from 'vitest';
import { authorParts, cleanText, pickMatch, searchTitle } from '../src/lib/openlibrary';
describe('openlibrary helpers', () => {
  it('flips and cleans author names', () => {
    expect(authorParts('Jefferson, Thomas, 1743-1826')).toEqual({ full: 'Thomas Jefferson', last: 'Jefferson' });
    expect(authorParts('Wodehouse, P. G. (Pelham Grenville)').full).toBe('P. G. Wodehouse');
    expect(authorParts('United States').full).toBe('United States');
  });
  it('cuts the title at a subtitle', () => expect(searchTitle('Moby Dick;\nor, The Whale')).toBe('Moby Dick'));
  it('accepts only a matching title and author', () => {
    const docs = [{ key: '/works/OL1W', title: 'Pride and Prejudice and Zombies', author_name: ['Seth Grahame-Smith'] }, { key: '/works/OL2W', title: 'Pride and Prejudice', author_name: ['Jane Austen'] }];
    expect(pickMatch(docs, 'Pride and prejudice', 'Austen, Jane')?.key).toBe('/works/OL2W');
    expect(pickMatch(docs, 'Pride and prejudice', 'Dickens, Charles')).toBeUndefined();
    expect(pickMatch(docs, 'Hi', undefined)).toBeUndefined();
  });
  it('cleans descriptions', () => {
    expect(cleanText({ value: 'A long enough story about [a ship](http://x.y).\n\n----------\nSee also more' })).toBe('A long enough story about a ship.');
    expect(cleanText('short')).toBeUndefined();
    expect(cleanText(undefined)).toBeUndefined();
    expect(cleanText('word '.repeat(400), 100)!.length).toBeLessThanOrEqual(101);
  });
});
import { vi } from 'vitest';
import { lookupOpenLibrary } from '../src/lib/openlibrary';
describe('lookup retries with looser searches', () => {
  it('finds a book when only the surname search matches', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url); const j = (x: unknown) => ({ ok: true, json: async () => x });
      if (url.includes('search.json')) return j(url.includes('author=Bos') ? { docs: [{ key: '/works/OL9W', title: "Toon van 't Veer", author_name: ['A. C. Bos'], author_key: ['OL1A'], first_publish_year: 1900 }] } : { docs: [] });
      if (url.includes('/works/')) return j({ description: 'A Dutch story about a boy named Toon and his village life.' });
      return j({ name: 'A. C. Bos', bio: 'A Dutch writer and teacher of the period.' });
    });
    const r = await lookupOpenLibrary('79722', 'Toon van ’t Veer', 'Bos, Arie Cornelis');
    expect(r?.year).toBe(1900); expect(r?.description).toMatch(/Dutch story/); expect(calls.filter((c) => c.includes('search.json')).length).toBe(2);
    vi.unstubAllGlobals();
  });
});

describe('cleanText html', () => {
  it('removes html links and tags but keeps the words', () => {
    const t = cleanText('A writer (<a href=http://en.wikipedia.org/wiki/RobertBarr(writer)>Wikipedia</a>). Friends with <a href="http://x.y/a">Jerome K. Jerome</a> &amp; <b>others</b>.<br>More text here.');
    expect(t).toBe('A writer (Wikipedia). Friends with Jerome K. Jerome & others.\nMore text here.');
    expect(t).not.toMatch(/href|<|>/);
  });
});
