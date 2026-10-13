// Turns normalized Gutenberg records into one compact catalog index: [id, title, authors[], languageIdx, subjectIdx[]]
export function createBuilder() {
  const books = new Map(), subjects = new Map(), langs = new Map(), years = new Map();
  const idx = (m, k) => { if (!m.has(k)) m.set(k, m.size); return m.get(k); };
  return {
    add(r) { for (const [n, b, d] of r.author_years ?? []) if (!years.has(n)) years.set(n, [b, d]); books.set(r.source_id, [r.source_id, r.title, r.authors, r.language ? idx(langs, r.language) : -1, r.subjects.map((s) => idx(subjects, s))]); },
    /** Birth and death years kept apart from the index: author name -> [born, died]. Used for author pages only. */
    years() { return years; },
    finish(meta) {
      const list = [...books.values()].sort((a, b) => Number(a[0]) - Number(b[0]));
      return { ...meta, count: list.length, subjects: [...subjects.keys()], langs: [...langs.keys()], books: list };
    },
  };
}
