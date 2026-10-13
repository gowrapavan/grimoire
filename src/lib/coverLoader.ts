// One shared cover loader. Every <Cover> for the same image (a row card, the quick-look window, a search thumbnail)
// asks this module instead of loading the image on its own, so:
//  - the same image is requested once, and every place showing it is updated when it arrives;
//  - a success anywhere (for example the quick-look window) fixes a blank cover everywhere else;
//  - only a few images are downloaded at a time, so a slow server is not flooded and a queued image is not timed out while it waits;
//  - a cover that gave up is tried again later (when it scrolls into view again, or the connection comes back), not never.
// No DOM code in here except the default probe at the bottom, so it can be tested in Node.

export type CoverStatus = 'loading' | 'ok' | 'fail';
export interface Probe { done: Promise<boolean>; cancel: () => void; pin?: unknown }
export type ProbeFn = (src: string) => Probe;
export interface CoverOptions {
  probe: ProbeFn;
  /** Most requests started for one image in one round (default 6). */
  attempts?: number;
  /** A single request that has not answered after this long is given up (ms). */
  attemptTimeout?: number;
  /** If a request is still waiting after this long, a second one is started next to it (ms). The first one keeps going; the first to finish wins. */
  hedgeAfter?: number;
  /** After a request fails, the next one starts after this long (ms). */
  retryDelay?: number;
  /** Images downloaded at the same time. */
  concurrency?: number;
  /** After giving up, wait this long before a new request may start another round of tries. */
  cooldown?: number;
  now?: () => number;
}
interface Entry { status: 'idle' | CoverStatus; src?: string; rev: number; failedAt: number; promise?: Promise<boolean>; pin?: unknown }
interface Job { key: string; run: () => void }

const withRetry = (url: string, n: number) => { if (!n) return url; try { const u = new URL(url); u.searchParams.set('retry', String(n)); return u.toString(); } catch { return url; } };
/** Gutenberg also has a small cover file, much lighter for tiny thumbnails. */
export const smallCover = (url: string) => url.replace('.cover.medium.', '.cover.small.');

export function createCoverLoader(opts: CoverOptions) {
  const attempts = opts.attempts ?? 6;
  const attemptTimeout = opts.attemptTimeout ?? 6000;
  const hedgeAfter = opts.hedgeAfter ?? 1200;
  const retryDelay = opts.retryDelay ?? 150;
  const concurrency = opts.concurrency ?? 6;
  const cooldown = opts.cooldown ?? 10000;
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((f) => f());
  const entry = (key: string): Entry => { let e = entries.get(key); if (!e) { e = { status: 'idle', rev: 0, failedAt: 0 }; entries.set(key, e); } return e; };
  const change = (e: Entry, patch: Partial<Entry>) => { Object.assign(e, patch); e.rev++; emit(); };

  // A small queue: at most `concurrency` attempts run at once. A priority request goes to the front.
  const queue: Job[] = []; let running = 0;
  const pump = () => { while (running < concurrency && queue.length) queue.shift()!.run(); };
  const promote = (key: string) => { const i = queue.findIndex((j) => j.key === key); if (i > 0) queue.unshift(queue.splice(i, 1)[0]); };
  const slot = <T,>(key: string, priority: boolean, fn: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    const job: Job = { key, run: () => { running++; fn().then(resolve, reject).finally(() => { running--; pump(); }); } };
    if (priority) queue.unshift(job); else queue.push(job);
    pump();
  });

  /** One request. `cancels` collects a way to stop it early (when another request for the same image already won). */
  const attempt = (src: string, ms: number, cancels: Set<() => void>) => new Promise<{ ok: boolean; pin?: unknown }>((resolve) => {
    const p = opts.probe(src); let over = false; let t: ReturnType<typeof setTimeout>;
    const end = (r: { ok: boolean; pin?: unknown }, stop: boolean) => { if (over) return; over = true; clearTimeout(t); cancels.delete(cancel); if (stop) p.cancel(); resolve(r); };
    const cancel = () => end({ ok: false }, true);
    cancels.add(cancel);
    t = setTimeout(cancel, ms);  // a request that never answers is given up
    p.done.then((ok) => end({ ok, pin: ok ? p.pin : undefined }, false), () => end({ ok: false }, false));
  });

  /** Loads one URL (with retries). Never rejects. Shares the request if one is already running. */
  function loadOne(url: string, priority: boolean, force = false): Promise<boolean> {
    const e = entry(url);
    if (e.status === 'ok') return Promise.resolve(true);
    if (e.promise) { if (priority) promote(url); return e.promise; }
    if (e.status === 'fail' && !force && now() - e.failedAt < cooldown) return Promise.resolve(false);
    change(e, { status: 'loading' });
    // Try fast: a failed request is retried after a very short pause, and a slow one gets a second request started beside it.
    // The first request to deliver the image wins and the others are stopped.
    const p = new Promise<boolean>((resolve) => {
      let started = 0, live = 0, finished = false; const cancels = new Set<() => void>(); let hedge: ReturnType<typeof setTimeout> | undefined; let retry: ReturnType<typeof setTimeout> | undefined;
      const finish = (ok: boolean, src?: string, pin?: unknown) => {
        if (finished) return; finished = true; clearTimeout(hedge); clearTimeout(retry); [...cancels].forEach((c) => c());
        if (ok) change(e, { status: 'ok', src, pin }); else change(e, { status: 'fail', failedAt: now() });
        resolve(ok);
      };
      const start = () => {
        if (finished || started >= attempts) return;
        const i = started++; live++; const src = withRetry(url, i);
        slot(url, priority || i > 0, () => (finished ? Promise.resolve({ ok: false }) : attempt(src, attemptTimeout, cancels))).then((r: { ok: boolean; pin?: unknown }) => {
          live--; if (finished) return;
          if (r.ok) return finish(true, src, r.pin);
          if (started < attempts) { clearTimeout(retry); retry = setTimeout(start, retryDelay); }
          else if (live === 0) finish(false);
        });
        armHedge();
      };
      const armHedge = () => {
        clearTimeout(hedge); if (started >= attempts) return;
        hedge = setTimeout(() => { if (finished) return; if (live < 2) start(); else armHedge(); }, hedgeAfter);
      };
      start();
    }).finally(() => { e.promise = undefined; });
    e.promise = p; return p;
  }

  return {
    /** Starts (or joins) loading a cover. Thumbnails ask for the small file first, then the medium one. Safe to call again and again. */
    ensure(url: string | undefined, o: { mini?: boolean; priority?: boolean; force?: boolean } = {}): void {
      if (!url) return;
      const pr = !!o.priority, fo = !!o.force;
      if (entries.get(url)?.status === 'ok') return;
      const small = o.mini ? smallCover(url) : url;
      if (small === url) { void loadOne(url, pr, fo); return; }
      if (entries.get(small)?.status === 'ok') return;
      void loadOne(small, pr, fo).then((ok) => { if (!ok) void loadOne(url, pr, fo); });
    },
    /** What a cover should show right now. A medium image that is already loaded is also used by thumbnails. */
    derive(url: string | undefined, mini = false): { status: CoverStatus; src?: string } {
      if (!url) return { status: 'fail' };
      const m = entries.get(url); if (m?.status === 'ok') return { status: 'ok', src: m.src };
      const sUrl = mini ? smallCover(url) : url;
      if (sUrl !== url) {
        const s = entries.get(sUrl); if (s?.status === 'ok') return { status: 'ok', src: s.src };
        if (!s || s.status !== 'fail') return { status: 'loading' };
      }
      return m?.status === 'fail' ? { status: 'fail' } : { status: 'loading' };
    },
    /** A short string that changes whenever something this cover shows could have changed. For useSyncExternalStore. */
    version(url: string | undefined, mini = false): string {
      if (!url) return '';
      const s = mini ? smallCover(url) : url;
      return `${entries.get(url)?.rev ?? 0}:${s === url ? '' : entries.get(s)?.rev ?? 0}`;
    },
    /** The image element said "error" even though the probe succeeded (for example it could not be re-used from cache). Treat as failed for now. */
    markBroken(url: string, src: string): void {
      for (const [k, e] of entries) if (e.status === 'ok' && e.src === src && (k === url || smallCover(url) === k)) change(e, { status: 'fail', failedAt: now(), src: undefined, pin: undefined });
    },
    /** Gives every failed cover another round now (used when the connection comes back). */
    retryFailed(): void { for (const [k, e] of [...entries]) if (e.status === 'fail') void loadOne(k, false, true); },
    subscribe(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; },
  };
}

// Real browser probe: an Image object. The loaded Image is kept ("pinned") so the browser keeps the picture in memory for the <img> tags that show it.
const imageProbe: ProbeFn = (src) => {
  const img = new Image(); img.decoding = 'async';
  const done = new Promise<boolean>((res) => { img.onload = () => res(true); img.onerror = () => res(false); });
  img.src = src;
  return { done, pin: img, cancel: () => { img.onload = null; img.onerror = null; img.src = ''; } };
};
export const covers = createCoverLoader({ probe: typeof Image !== 'undefined' ? imageProbe : () => ({ done: Promise.resolve(false), cancel: () => {} }) });
if (typeof window !== 'undefined') window.addEventListener('online', () => covers.retryFailed());
