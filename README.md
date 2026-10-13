# Biblorya (static catalog, no database)

## Netlify deployment

This project uses a Netlify Edge Function (`netlify/edge-functions/seo.ts`) to run the SEO handler in `worker/index.ts`. The `dist/_worker.js` artifact is retained only for compatibility with the existing build script; Netlify does not execute it as a Cloudflare Pages worker.

- Build command: `npm run build:catalog && npm run build`
- Publish directory: `dist`
- Configuration: `netlify.toml`
- Edge Function route: `/*`
- Optional Netlify environment variable: `SITE_URL` set to the final canonical HTTPS origin (for example `https://biblorya.netlify.app` after that site name is assigned).

The edge handler creates `/robots.txt`, `/sitemap.xml`, `/sitemaps/sitemap-*.xml`, book-specific HTML metadata, share-card tags, and real 404 responses. Generated catalog metadata is read from `public/catalog/`. The static `public/robots.txt` is a fallback; keep its sitemap origin synchronized with the final deployment domain if the edge function is unavailable.

Before deployment, run `npm test`, then `npm run build:catalog && npm run build`. The catalog build downloads the current Project Gutenberg CSV unless `FEED_FILE` is supplied. Validate the live `/robots.txt`, `/sitemap.xml`, one book URL, and a nonexistent book URL after deploying.

Real Project Gutenberg catalog data, searched in the browser. No Supabase, no server, no keys.

## Run it (Windows PowerShell, in this folder)
    npm install
    npm run build:catalog     # downloads Gutenberg's catalog list (not books) and writes public/catalog/index.json
    npm run dev               # open the address it prints
Quick pilot first:  `$env:LIMIT="500"; npm run build:catalog`  (then later clear it with `Remove-Item Env:LIMIT` and run again for everything)

## Checks
    npm test
    npm run build

## Deploy (Netlify)
Connect the GitHub repository in Netlify and use the build command `npm run build:catalog && npm run build` with publish directory `dist`. Keep `netlify.toml` and `netlify/edge-functions/seo.ts` in the repository. Set `SITE_URL` in the Netlify environment variables to the final canonical HTTPS origin after the site name or custom domain is assigned. Netlify executes the Edge Function; it does not execute `dist/_worker.js` as a Cloudflare Pages worker.

Refresh the catalogue by redeploying. Gutenberg updates its file periodically.

## Notes
- The app never shows made-up books. If public/catalog/index.json is missing, it says so.
- Gutenberg has no reliable print year, so there are no year filters. "Recent" means highest Gutenberg id.
- Covers: loaded from gutenberg.org by id pattern (src/lib/sourceLinks.ts) through one shared loader (src/lib/coverLoader.ts): each image is requested once and every place showing it updates together, at most 6 download at a time; a failed request is retried after 150 ms, and a request still waiting after 1.2 s gets a second one started beside it (first to finish wins, up to 6 requests per round); thumbnails use the small file first. A cover that gave up is tried again when it scrolls into view after 10 seconds, or when the connection returns. A labelled drawn cover shows meanwhile. Set SHOW_GUTENBERG_COVERS=false to switch off.
- Read now: opens /read/<id>. It first tries the plain text as pages in the app; if that request fails (Gutenberg busy, or blocked by CORS) it shows Gutenberg's own HTML page in a sandboxed frame, with Try again and download links.
- Open Library: used live on the book page only (description, first publication year, author notes). Not stored, and no confident match means nothing is shown. Footer contact email is set in src/App.tsx.

## Advertisement banners
Edit `public/advertisement.json`. Slots `ad1` (home page, book page) and `ad2` (search page) each take:
- `image` / `video`: used on desktop and tablet. Wide, for example 1200x300.
- `mobileImage` / `mobileVideo`: used on phones (under 640px). Wider-to-taller, for example 800x400.
- `link` (required) and `title`.
Use a full https URL, or put files in `public/ads/` and use `/ads/yourfile.png`. If only one size is given it is used everywhere. Banners show in full, never cropped. A slot with a blank link or no media is hidden.

## Reading and downloads
The Read page first tries to load the book's plain text (`pgNNNN.txt`) and shows it as pages, with chapters, text size and a remembered place. If Gutenberg blocks that request from the browser (CORS) or the file is missing, it falls back to Gutenberg's own HTML page in a frame. The book page has download buttons (EPUB, Kindle, HTML zip, text); not every book has every format.

## Library banner
The home page has a "reading room" banner. It is a drawn scene by default. To use your own photo, save it as `public/library-banner.jpg` (wide, about 1600x500).

## SEO, link previews and Google Search Console
The app is a single-page app, so on its own Google would have to run JavaScript to see anything, and WhatsApp, Facebook, X and Telegram would show no title or cover. `dist/_worker.js` (built from `worker/index.ts`) answers every page address itself and puts the right tags in the first HTML.

### What each page gets
| Address | Title / description | Canonical | Structured data | Indexed? |
|---|---|---|---|---|
| `/` | yes | yes | WebSite (with SearchAction), Organization | yes |
| `/search` (catalogue) | yes | yes | none | yes |
| `/search?subject=X` | yes, with the real book count | yes | BreadcrumbList | only if the subject has 10 or more books |
| `/book/<id>` | unique, from title, author, language, subjects | yes | Book (author Person with link, publisher, sameAs Project Gutenberg, ReadAction), BreadcrumbList | yes |
| `/author/<name>` | unique, with years and book count | yes | Person, ItemList, BreadcrumbList | only if the author has 2 or more books |
| `/search?q=...`, `?page=2`, `?language=...` | generic | points to the page without the filter | none | no (`noindex`, also disallowed in robots.txt) |
| `/read/<id>`, `/shelf` | generic | n/a | none | no (`noindex`) |
| anything else | "Page not found" | n/a | none | no: real HTTP 404 with `noindex` |

- A book, author or reader address that does not exist returns HTTP 404, not an empty page with 200. A missing file (for example `/missing.png`) also returns 404.
- Book and author pages also contain their main facts as plain text, with links to the author, subjects and the Project Gutenberg page, so crawlers can follow them without running JavaScript.
- `/og/<id>.jpg` is the share picture: the book's cover from Project Gutenberg served from your own address (cached for a week). If Gutenberg has no cover or is slow, `public/og-default.png` (1200x630) is used. Replace that file to change the default picture.
- Access and copyright: every book page links to the original Project Gutenberg page, says the access status is "per Project Gutenberg", and says copyright rules differ by country (with a link to Gutenberg's permissions page). The site makes no claim of its own that a text is public domain.
- Sitemaps: `/sitemap.xml` lists `sitemap-pages` (home, catalogue, subject pages), `sitemap-books-N` (every book) and `sitemap-authors-N` (authors with 2 or more books), 20,000 addresses per file. `robots.txt` points to it.
- `npm run build:catalog` writes the small files the worker reads: `public/catalog/meta/` (500 books each), `authors/` (64 files), `subjects.json`, `sitemaps/` and `seo.json`. The catalogue uses compact metadata shards rather than generating one HTML file per book. Birth and death years on author pages are the ones the Project Gutenberg catalogue gives; authors without years show none.
- `public/_routes.json` sends page addresses to the worker and leaves images, scripts and catalog files to the static host. `public/_headers` sets long caching for built files and one-hour caching for catalog files.

### Settings (Cloudflare Pages > Settings > Variables and Secrets)
| Name | Value | Purpose |
|---|---|---|
| `SITE_URL` | `https://www.yourdomain.com` | The address used in canonical links, share tags and sitemaps. Set this to your main domain. |
| `CANONICAL_REDIRECT` | `true` | Optional. Sends the `*.pages.dev` address and other hosts to `SITE_URL` with a 301, so there is one address per page. Leave it off while testing previews. |
| `GOOGLE_SITE_VERIFICATION` | the `content` value of Google's HTML tag | Adds Google's verification tag to every page. |
| `GOOGLE_VERIFICATION_FILE` | for example `google1a2b3c4d5e6f.html` | Serves Google's verification file at that address. |
| `BING_SITE_VERIFICATION` | the Bing tag value | Adds Bing's verification tag. |

### Submit the site to Google Search Console
1. Deploy through Netlify using `npm run build:catalog && npm run build` and publish `dist`. Set `SITE_URL` in the Netlify environment variables.
2. Open https://search.google.com/search-console and choose Add property.
3. Recommended: choose **Domain** and verify with the DNS TXT record Google shows (add it where your domain's DNS is managed; in your domain DNS provider). It covers http, https, www and non-www together.
   Alternative: choose **URL prefix**, enter your `SITE_URL`, pick the **HTML tag** method, copy the `content` value into the `GOOGLE_SITE_VERIFICATION` setting, redeploy, then click Verify. Or pick the **HTML file** method and put the file name in `GOOGLE_VERIFICATION_FILE`.
4. In Search Console open **Sitemaps** and submit `sitemap.xml`. Status should become Success, with the three sitemap files listed.
5. Open **URL Inspection**, paste the home page, a few book pages and an author page, and use **Request indexing** for each. This is optional and limited to a few a day.
6. Check later in **Pages** (indexing report) and **Core Web Vitals**. Expect days to weeks before many pages appear: Google decides how much of a site to crawl, and neither this site nor any setting can guarantee indexing or rankings.
7. Do the same in Bing Webmaster Tools (it can import the site from Search Console).

### Check it after deploy
- Open `/robots.txt`, `/sitemap.xml`, one book page and one author page; use View page source and look for the title, canonical, `og:image` and the `application/ld+json` block.
- Paste a book link in Facebook's Sharing Debugger and the Rich Results Test (https://search.google.com/test/rich-results).
- An address that does not exist (for example `/book/999999999`) should show "Page not found" with status 404 (browser developer tools, Network tab).
- The Vite development server does not run the Netlify Edge Function. Verify server-generated tags after deployment or use Netlify CLI to test the edge runtime locally.

### Page speed notes
- A book page reads one small metadata file (about 100 KB) to show the book, and loads the full catalogue index afterwards, in the background, for "More like this". Reader, My shelf and author pages are loaded only when opened. Covers reserve their space (no layout jump), the main cover loads first, the font stylesheet no longer blocks the first paint, and built files are cached for a year.
- Not done: self-hosting the fonts (they come from Google Fonts), and a measured Lighthouse run on your real domain. Run PageSpeed Insights on your live address to see real Core Web Vitals.
