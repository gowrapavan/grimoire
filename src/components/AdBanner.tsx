import { useEffect, useState } from 'react';
import { useIsPhone } from '../lib/hooks';
// Reads public/advertisement.json. A slot with no link or no media is not shown at all.
// "image"/"video" are for desktop and tablet; "mobileImage"/"mobileVideo" are used on phones (under 640px).
// If a mobile file is missing, the desktop one is used (and the other way round).
export type AdSlot = 'ad1' | 'ad2';
interface Ad { title?: string; image?: string; video?: string; mobileImage?: string; mobileVideo?: string; link?: string }
type Ads = Record<string, Ad>;
let cache: Promise<Ads> | null = null;
const load = (): Promise<Ads> => (cache ??= fetch(`${import.meta.env.BASE_URL}advertisement.json`).then((r): Promise<Ads> | Ads => (r.ok ? r.json() : {})).catch((): Ads => ({})));
const safeLink = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : '');
export function AdBanner({ slot, className = '' }: { slot: AdSlot; className?: string }) {
  const [ad, setAd] = useState<Ad | null>(null); const phone = useIsPhone();
  useEffect(() => { let live = true; load().then((j) => { if (live) setAd(j?.[slot] ?? null); }); return () => { live = false; }; }, [slot]);
  const link = safeLink(ad?.link);
  const pick = (desktop?: string, mobile?: string) => (phone ? mobile || desktop : desktop || mobile) || '';
  const video = pick(ad?.video, ad?.mobileVideo), image = pick(ad?.image, ad?.mobileImage);
  if (!ad || !link || !(video || image)) return null;
  const title = ad.title || 'My other app';
  return (
    <aside aria-label="More from the maker of Grimoire" className={className}>
      <p className="mb-1 text-sm italic text-muted">Advertisement: more from the maker of Grimoire</p>
      <a href={link} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${title} (opens in a new tab)`} className="block overflow-hidden border-4 border-double border-line bg-card">
        {video
          ? <video key={video} src={video} poster={image || undefined} autoPlay muted loop playsInline aria-hidden="true" className="block h-auto w-full" />
          : <img key={image} src={image} alt={title} loading="lazy" className="block h-auto w-full" />}
      </a>
    </aside>
  );
}
