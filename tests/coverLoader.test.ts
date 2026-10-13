import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoverLoader, smallCover, type Probe } from '../src/lib/coverLoader';

const MED = 'https://www.gutenberg.org/cache/epub/5/pg5.cover.medium.jpg';
// A fake network: each request waits until the test answers it (true = loaded, false = error) or never answers.
function net() {
  const calls: { src: string; answer: (ok: boolean) => void; cancelled: boolean }[] = [];
  const probe = (src: string): Probe => {
    let answer!: (ok: boolean) => void; const done = new Promise<boolean>((r) => { answer = r; });
    const c = { src, answer, cancelled: false }; calls.push(c);
    return { done, cancel: () => { c.cancelled = true; }, pin: src };
  };
  return { calls, probe };
}
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('shared cover loader', () => {
  it('requests an image once however many covers ask, and all of them see the result', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe });
    L.ensure(MED); L.ensure(MED, { priority: true }); L.ensure(MED); await tick();
    expect(n.calls).toHaveLength(1);
    expect(L.derive(MED).status).toBe('loading');
    n.calls[0].answer(true); await tick();
    expect(L.derive(MED)).toEqual({ status: 'ok', src: MED });
  });
  it('retries a failed request almost at once', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe });
    L.ensure(MED); await tick(); n.calls[0].answer(false); await tick(150);
    expect(n.calls).toHaveLength(2); expect(n.calls[1].src).toContain('retry=1');
    n.calls[1].answer(true); await tick();
    expect(L.derive(MED)).toEqual({ status: 'ok', src: `${MED}?retry=1` });
  });
  it('a slow request gets a second one beside it; the first to finish wins and the other is stopped', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe });
    L.ensure(MED); await tick(1199); expect(n.calls).toHaveLength(1);
    await tick(1); expect(n.calls).toHaveLength(2); expect(n.calls[0].cancelled).toBe(false);  // the first keeps going
    n.calls[1].answer(true); await tick();
    expect(L.derive(MED).status).toBe('ok'); expect(n.calls[0].cancelled).toBe(true);
    await tick(10000); expect(n.calls).toHaveLength(2);                                         // nothing more is started
  });
  it('the first request can still win after a second one was started', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe });
    L.ensure(MED); await tick(1200); n.calls[0].answer(true); await tick();
    expect(L.derive(MED)).toEqual({ status: 'ok', src: MED }); expect(n.calls[1].cancelled).toBe(true);
  });
  it('gives up on a request that never answers, then fails after the last try', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe, attempts: 2, attemptTimeout: 100, hedgeAfter: 10_000, retryDelay: 10 });
    L.ensure(MED); await tick(100);
    expect(n.calls[0].cancelled).toBe(true); await tick(10); expect(n.calls).toHaveLength(2);
    await tick(100); expect(L.derive(MED).status).toBe('fail');
  });
  it('THE BUG: a cover that gave up is fixed when another place later loads it', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe, attempts: 2, hedgeAfter: 10_000, retryDelay: 5, cooldown: 1000 });
    const seen: string[] = []; L.subscribe(() => seen.push(L.derive(MED).status));
    L.ensure(MED);                                    // the row gives up...
    await tick(); n.calls[0].answer(false); await tick(5); n.calls[1].answer(false); await tick();
    expect(L.derive(MED).status).toBe('fail');
    L.ensure(MED, { priority: true });                // ...the quick-look window asks too soon: cooldown, no new request
    await tick(); expect(n.calls).toHaveLength(2);
    await tick(1000); L.ensure(MED, { priority: true }); await tick();  // later (or when scrolled into view again) a new round starts
    expect(n.calls).toHaveLength(3); n.calls[2].answer(true); await tick();
    expect(L.derive(MED).status).toBe('ok');          // the row's own derive() now says ok, with no request of its own
    expect(seen.at(-1)).toBe('ok');                   // and it was notified
  });
  it('thumbnails try the small file first, then the medium one', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe, attempts: 1, hedgeAfter: 10_000 });
    L.ensure(MED, { mini: true }); await tick();
    expect(n.calls[0].src).toBe(smallCover(MED)); expect(L.derive(MED, true).status).toBe('loading');
    n.calls[0].answer(false); await tick();
    expect(n.calls[1].src).toBe(MED); n.calls[1].answer(true); await tick();
    expect(L.derive(MED, true)).toEqual({ status: 'ok', src: MED });
  });
  it('a loaded medium cover is reused by thumbnails without another request', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe });
    L.ensure(MED); await tick(); n.calls[0].answer(true); await tick();
    L.ensure(MED, { mini: true }); await tick();
    expect(n.calls).toHaveLength(1); expect(L.derive(MED, true).src).toBe(MED);
  });
  it('downloads only a few at a time, and a priority cover jumps the queue', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe, concurrency: 2, hedgeAfter: 10_000_000 });
    const u = (i: number) => `https://x.test/${i}.cover.medium.jpg`;
    for (let i = 1; i <= 4; i++) L.ensure(u(i)); await tick();
    expect(n.calls).toHaveLength(2);
    L.ensure(u(4), { priority: true }); n.calls[0].answer(true); await tick();
    expect(n.calls[2].src).toBe(u(4));
  });
  it('markBroken turns a cover back to failed instead of looping', async () => {
    const n = net(); const L = createCoverLoader({ probe: n.probe });
    L.ensure(MED); await tick(); n.calls[0].answer(true); await tick();
    L.markBroken(MED, MED); expect(L.derive(MED).status).toBe('fail');
  });
});
