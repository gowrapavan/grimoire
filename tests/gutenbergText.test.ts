import { describe, it, expect } from 'vitest';
import { parseGutenbergText, stripBoilerplate, toBlocks } from '../src/lib/gutenbergText';
const SAMPLE = `The Project Gutenberg eBook of Ennui\n\nlegal text here\n\n*** START OF THE PROJECT GUTENBERG EBOOK ENNUI ***\n\n\n\n                                 Ennui\n\n                            by Milton Lesser\n\n\n\nYou could not blame me for being bitter. I work hard and I work all\nday; and when I came home that night, my wife was sitting on the sofa.\n\n\n\n                                   2\n\n\nI was a theoretical solipsist. If he _wasn’t_, then I could be happy.\n\n       *       *       *       *       *\n\nA week later, I made Tom disappear.\n\n\n\nCHAPTER III. THE VOID\n\nRoses are red,\nViolets are blue,\nSugar is sweet,\nAnd so are you.\n\n*** END OF THE PROJECT GUTENBERG EBOOK ENNUI ***\n\nLicense text`;
describe('gutenberg text parsing', () => {
  it('removes the Gutenberg header and footer', () => {
    const t = stripBoilerplate(SAMPLE);
    expect(t).not.toMatch(/legal text|License text|START OF|END OF/); expect(t).toMatch(/You could not blame me/);
  });
  it('finds paragraphs, headings, rules and verse', () => {
    const kinds = toBlocks(stripBoilerplate(SAMPLE)).map((b) => b.kind + ':' + b.text.slice(0, 12));
    expect(kinds).toContain('h:2'); expect(kinds).toContain('rule:'); expect(kinds).toContain('h:CHAPTER III.');
    expect(toBlocks(stripBoilerplate(SAMPLE)).find((b) => b.kind === 'verse')?.text.split('\n').length).toBe(4);
    expect(toBlocks(stripBoilerplate(SAMPLE)).find((b) => b.text.startsWith('You could'))?.text).toBe('You could not blame me for being bitter. I work hard and I work all day; and when I came home that night, my wife was sitting on the sofa.');
  });
  it('builds pages and a contents list', () => {
    const big = Array.from({ length: 60 }, (_, i) => (i % 20 === 0 ? `CHAPTER ${i / 20 + 1}\n\n` : '') + 'Lorem ipsum dolor sit amet. '.repeat(15)).join('\n\n');
    const r = parseGutenbergText(big, 2000);
    expect(r.pages.length).toBeGreaterThan(3); expect(r.toc.map((t) => t.title)).toEqual(['CHAPTER 1', 'CHAPTER 2', 'CHAPTER 3']);
  });
  it('copes with text that has no markers or is empty', () => {
    expect(parseGutenbergText('Just some text.\n\nAnother paragraph.').pages[0].length).toBe(2);
    expect(parseGutenbergText('').pages.length).toBe(0);
  });
});
