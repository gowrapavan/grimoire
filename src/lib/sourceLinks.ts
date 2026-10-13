// URL patterns for Project Gutenberg, derived from the book id. Whether a given file exists is NOT checked here:
// the cover falls back to a drawn cover on load error, and the read link is labelled as possibly unavailable.
export const SHOW_GUTENBERG_COVERS = true; // set to false to stop loading images from gutenberg.org
export const gutenberg = {
  landing: (id: string) => `https://www.gutenberg.org/ebooks/${id}`,
  cover: (id: string) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
  readHtml: (id: string) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.html`,
  text: (id: string) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  /** Download links. Same pattern for every book, but not every book has every file (for example no images, or no HTML). */
  files: (id: string): { label: string; hint: string; url: string }[] => [
    { label: 'EPUB', hint: 'with images, for most e-readers and phones', url: `https://www.gutenberg.org/ebooks/${id}.epub.images` },
    { label: 'EPUB, no images', hint: 'smaller file', url: `https://www.gutenberg.org/ebooks/${id}.epub.noimages` },
    { label: 'Kindle', hint: 'newer Kindles (KF8)', url: `https://www.gutenberg.org/ebooks/${id}.kf8.images` },
    { label: 'Older Kindle', hint: 'MOBI', url: `https://www.gutenberg.org/ebooks/${id}.kindle.images` },
    { label: 'HTML (zip)', hint: 'to read offline in a browser', url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}-h.zip` },
    { label: 'Plain text', hint: 'opens in the browser', url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt` },
  ],
};
