import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSurprise } from '../lib/hooks';

// A drawn reading room: two tall bookcases, an arched window with light, a desk with a lamp, and a ladder.
// To use a real photo instead, put it at public/library-banner.png (a wide image, about 1600x500). It is picked up automatically.
const BOOKS = ['#5b1a20', '#1f3a2e', '#2b2f4a', '#4a3220', '#3d2a45', '#243b4a', '#7a2a2a', '#2f4a3a', '#6b5230', '#d9c79a'];
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function Bookcase({ x, w, seed }: { x: number; w: number; seed: number }) {
  const parts = useMemo(() => {
    const r = rng(seed); const out: React.ReactNode[] = []; const shelves = 6, top = 30, shelfH = 52;
    for (let s = 0; s < shelves; s++) {
      const base = top + (s + 1) * shelfH; let cx = x + 10;
      while (cx < x + w - 14) {
        const bw = 7 + r() * 12, bh = 28 + r() * (shelfH - 36), color = BOOKS[Math.floor(r() * BOOKS.length)];
        if (cx + bw > x + w - 10) break;
        out.push(<rect key={`${s}-${cx}`} x={cx} y={base - bh} width={bw} height={bh} fill={color} />);
        out.push(<rect key={`b${s}-${cx}`} x={cx} y={base - bh + 5} width={bw} height="2" fill="#c9a24b" opacity=".7" />);
        cx += bw + 0.6;
        if (r() < 0.07) cx += 12 + r() * 14; // a gap, as if a book was taken out
      }
      out.push(<rect key={`p${s}`} x={x + 4} y={base} width={w - 8} height="5" fill="#4a2f1a" />);
    }
    return out;
  }, [x, w, seed]);
  return <g><rect x={x} y="22" width={w} height="320" fill="#2a190e" /><rect x={x + 4} y="30" width={w - 8} height="312" fill="#150d07" />{parts}
    <rect x={x - 6} y="14" width={w + 12} height="12" fill="#5a3a1f" /><rect x={x - 6} y="22" width={w + 12} height="3" fill="#8a6330" opacity=".6" /></g>;
}
function Scene() {
  return (
    <svg viewBox="0 0 1200 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="lb-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#32201a" /><stop offset="1" stopColor="#1a100b" /></linearGradient>
        <linearGradient id="lb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7e2a3" /><stop offset="1" stopColor="#e9a96a" /></linearGradient>
        <linearGradient id="lb-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a3a22" /><stop offset="1" stopColor="#2a1a0f" /></linearGradient>
        <linearGradient id="lb-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".42" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></linearGradient>
        <radialGradient id="lb-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffd98a" stopOpacity=".85" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
        <radialGradient id="lb-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".6" /></radialGradient>
      </defs>
      <rect width="1200" height="380" fill="url(#lb-wall)" />
      <Bookcase x={24} w={340} seed={11} /><Bookcase x={836} w={340} seed={29} />
      {/* arched window */}
      <path d="M470 300 V130 a130 130 0 0 1 260 0 V300 Z" fill="#2a190e" /><path d="M482 296 V132 a118 118 0 0 1 236 0 V296 Z" fill="url(#lb-sky)" />
      <g stroke="#2a190e" strokeWidth="5"><path d="M600 14 V296 M482 190 H718 M530 60 V296 M670 60 V296" fill="none" /></g>
      <path d="M482 296 H718" stroke="#5a3a1f" strokeWidth="10" />
      {/* light falling from the window */}
      <polygon points="490,296 710,296 880,372 320,372" fill="url(#lb-beam)" /><polygon points="560,296 640,296 700,372 500,372" fill="url(#lb-beam)" opacity=".6" />
      {/* floor */}
      <rect y="340" width="1200" height="40" fill="url(#lb-floor)" /><g stroke="#1a100b" strokeWidth="1.5" opacity=".5"><path d="M0 352 H1200 M0 366 H1200" /></g>
      {/* ladder */}
      <g stroke="#7a5230" strokeWidth="5" strokeLinecap="round"><path d="M392 342 L372 40 M424 342 L404 40" />{[80, 130, 180, 230, 280].map((y) => <path key={y} d={`M${396 - (y - 40) * 0.065} ${y} H${428 - (y - 40) * 0.065}`} />)}</g>
      {/* desk, lamp, open book */}
      <rect x="500" y="296" width="200" height="14" fill="#6b4524" /><rect x="510" y="310" width="10" height="32" fill="#4a2f1a" /><rect x="680" y="310" width="10" height="32" fill="#4a2f1a" />
      <circle cx="660" cy="262" r="64" fill="url(#lb-lamp)" /><rect x="656" y="270" width="8" height="26" fill="#8a6330" /><path d="M640 272 Q660 238 680 272 Z" fill="#1f5a3e" /><rect x="646" y="294" width="28" height="4" fill="#8a6330" />
      <path d="M540 296 L570 288 L600 296 L600 300 L570 292 L540 300 Z" fill="#efe2bd" /><rect x="610" y="284" width="26" height="12" fill="#5b1a20" /><rect x="614" y="276" width="20" height="8" fill="#2b2f4a" />
      <rect width="1200" height="380" fill="url(#lb-vig)" />
    </svg>
  );
}
export function LibraryBanner() {
  const surprise = useSurprise(); const [photo, setPhoto] = useState(false);
  useEffect(() => { const i = new Image(); i.onload = () => setPhoto(true); i.src = `${import.meta.env.BASE_URL}library-banner.png`; }, []);
  return (
    <section aria-labelledby="lib-h" className="relative isolate h-64 overflow-hidden border-4 border-double border-line bg-[#1a100b] sm:h-80">
      {photo ? <img src={`${import.meta.env.BASE_URL}library-banner.png`} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Scene />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-4 pt-12 text-center sm:pb-6">
        <h2 id="lib-h" className="text-2xl text-[#f3e3b3] sm:text-4xl">The reading room is open</h2>
        <p className="mx-auto mt-1 max-w-xl italic text-[#e6d5a8]">Shelf after shelf of free classics. Wander in and see what catches your eye.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:gap-3">
          <Link to="/search?sort=title" className="bg-oxblood px-4 py-2 font-display text-on no-underline hover:bg-oxblood-dark sm:px-5">Browse the shelves</Link>
          <button type="button" onClick={surprise} className="border border-[#e6d5a8] px-4 py-2 font-display text-[#f3e3b3] hover:bg-white/10 sm:px-5">Surprise me</button>
        </div>
      </div>
    </section>
  );
}
