import { useEffect } from 'react';
import { headTags, type Head } from './seoText';
// Keeps the page title, description, canonical address, share tags and structured data in step with the page being shown.
// The server (worker/index.ts) already puts the right tags in the first HTML; this keeps them right when you move between pages without a reload.
let origin: string | null = null;
function siteOrigin(): string {
  if (origin) return origin;
  try { const c = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href; origin = c ? new URL(c).origin : window.location.origin; } catch { origin = window.location.origin; }
  return origin;
}
function meta(attr: string, key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
export function applyHead(h: Head) {
  const t = headTags(h, siteOrigin());
  document.title = t.title;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = t.canonical;
  document.head.querySelectorAll('meta[property="book:tag"], meta[property="og:image"], meta[property="og:image:alt"], meta[property="og:image:width"], meta[property="og:image:height"], meta[name="twitter:image"], meta[name="twitter:image:alt"]').forEach((e) => e.remove());
  for (const [a, k, v] of t.metas) { if (k === 'book:tag' || k.includes('image')) { const el = document.createElement('meta'); el.setAttribute(a, k); el.setAttribute('content', v); document.head.appendChild(el); } else meta(a, k, v); }
  let ld = document.getElementById('grimoire-ld');
  if (t.ld) { if (!ld) { ld = document.createElement('script'); ld.id = 'grimoire-ld'; ld.setAttribute('type', 'application/ld+json'); document.head.appendChild(ld); } ld.textContent = t.ld; } else ld?.remove();
}
/** Pass the page's head, or null while the page is still loading (the previous tags stay until then). */
export function useSeo(h: Head | null) {
  const key = h ? JSON.stringify([h.title, h.description, h.path, h.image, h.robots]) : '';
  useEffect(() => { if (h) applyHead(h); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}
