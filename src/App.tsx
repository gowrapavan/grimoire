import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Loading, Mark, Ornament, SearchBox } from './components/ui';
import { ToastProvider } from './components/Toast';
import { QuickViewProvider } from './components/QuickView';
import { PaletteProvider, usePalette } from './components/Palette';
import { useTheme } from './lib/theme';
import { useShelf } from './lib/shelf';
import { useScrolled } from './lib/hooks';
import Home from './pages/Home';
import Search from './pages/Search';
import BookPage from './pages/BookPage';
// Pages most visitors never open are loaded only when needed, so the first page downloads less code.
const Reader = lazy(() => import('./pages/Reader'));
const MyShelf = lazy(() => import('./pages/MyShelf'));
const AuthorPage = lazy(() => import('./pages/AuthorPage'));
import { useSeo } from './lib/useSeo';
import { notFoundHead } from './lib/seoText';
function NotFound() {
  useSeo(notFoundHead());
  return <p className="py-16 text-center font-display text-2xl">Page not found. <Link className="underline" to="/">Return to the catalogue</Link></p>;
}
function Header({ dark, toggleTheme }: { dark: boolean; toggleTheme: () => void }) {
  const { pathname } = useLocation(); const { ids } = useShelf(); const pal = usePalette();
  const nav = ({ isActive }: { isActive: boolean }) => `no-underline hover:text-oxblood ${isActive ? 'text-oxblood underline' : ''}`;
  const ib = 'grid h-9 w-9 place-items-center rounded-full border border-line hover:border-oxblood hover:text-oxblood';
  return (
    <header className="border-b-4 border-double border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-3 px-3 py-3 sm:gap-x-5 sm:px-4">
        <Link to="/" className="flex items-center gap-2 no-underline sm:gap-3"><span className="scale-90 sm:scale-100"><Mark /></span><span className="font-display text-[1.35rem] text-oxblood sm:text-3xl">Biblorya</span></Link>
        {pathname !== '/' && <div className="order-last w-full lg:order-none lg:w-auto lg:max-w-md lg:flex-1"><SearchBox /></div>}
        <nav aria-label="Main" className="ml-auto flex items-center gap-2 text-[0.95rem] sm:gap-5 sm:text-lg">
          <NavLink to="/search?sort=title" className={() => `no-underline hover:text-oxblood ${pathname === '/search' ? 'text-oxblood underline' : ''}`}>Browse</NavLink>
          <NavLink to="/shelf" className={nav}>My shelf{ids.length > 0 && <span className="ml-1.5 rounded-full bg-oxblood px-2 text-sm text-on" aria-label={`${ids.length} saved`}>{ids.length}</span>}</NavLink>
          <button type="button" onClick={pal.open} aria-label="Search and quick actions (Ctrl+K)" title="Search anywhere (Ctrl+K)" className={`${ib} hidden sm:grid`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></svg></button>
          <button type="button" onClick={toggleTheme} aria-label={dark ? 'Switch to daylight colours' : 'Switch to lamplight colours'} title={dark ? 'Daylight' : 'Lamplight'} className={ib}>
            {dark
              ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>
              : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>}
          </button>
        </nav>
      </div>
    </header>
  );
}
function BackToTop() {
  const show = useScrolled(700);
  if (!show) return null;
  return <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top" className="fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-brass-soft bg-footer text-footer-ink shadow-[0_4px_12px_rgba(0,0,0,.35)] hover:brightness-125">↑</button>;
}
function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation(); const { dark, toggle } = useTheme();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <PaletteProvider dark={dark} toggleTheme={toggle}>
      <div className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3">Skip to content</a>
        <Header dark={dark} toggleTheme={toggle} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4 sm:py-10">{children}</main>
        <BackToTop />
        <footer className="bg-footer px-4 py-8 text-[0.95rem] sm:py-12 text-footer-ink/90 [overflow-wrap:anywhere]">
          <Ornament className="mb-6 sm:mb-8" />
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
            <div><p className="font-display text-xl text-footer-ink">Where the records come from</p>
              <p className="mt-2">The Project Gutenberg catalog feed (pg_catalog.csv). On a book page, the description, first publication year and author notes are looked up from Open Library when available.</p></div>
            <div><p className="font-display text-xl text-footer-ink">About access</p>
              <p className="mt-2">Biblorya keeps records only, never book files. Public-domain and access status are claims made by each source and can differ by country. Always check the source page, and see Project Gutenberg’s <a className="underline" href="https://www.gutenberg.org/policy/permission.html" target="_blank" rel="noopener noreferrer">permissions page</a> before reusing a text.</p></div>
            <div><p className="font-display text-xl text-footer-ink">Corrections and removal</p>
              <p className="mt-2">To correct or remove a record, email <a className="underline" href="mailto:gowrapavankumar2004@gmail.com">gowrapavankumar2004@gmail.com</a> with the record link. We will respond and remove it on request.</p></div>
          </div>
        </footer>
      </div>
    </PaletteProvider>
  );
}
export default function App() {
  return (
    <ToastProvider>
      <QuickViewProvider>
        <Shell>
          <Suspense fallback={<Loading label="Loading page" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/book/:id" element={<BookPage />} />
            <Route path="/read/:id" element={<Reader />} />
            <Route path="/shelf" element={<MyShelf />} />
            <Route path="/author/:slug" element={<AuthorPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </Shell>
      </QuickViewProvider>
    </ToastProvider>
  );
}
