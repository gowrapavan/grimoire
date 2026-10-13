import type { AccessStatus, SourceName } from './types';
export const ACCESS: Record<AccessStatus, { label: string; short: string; explain: string; cls: string }> = {
  open_access: { label: 'Open access', short: 'Open access', cls: 'bg-teal/10 text-teal ring-teal/30',
    explain: 'The source’s own page says this title is free to access. Rights are determined by the source, and may differ by country.' },
  borrowable: { label: 'Borrowable', short: 'Borrowable', cls: 'bg-ink/10 text-ink ring-ink/30',
    explain: 'An authorized lending page was confirmed for this title. Lending rules are set by the source.' },
  external_link: { label: 'Source page', short: 'Source page', cls: 'bg-brass-soft/20 text-brass ring-brass/40',
    explain: 'A source page exists, but we can’t tell whether access is free, limited or paid. Check the source for terms.' },
  metadata_only: { label: 'Record only', short: 'Record only', cls: 'bg-paper-2 text-muted ring-line',
    explain: 'We hold a catalog record only. No access path is known.' },
};
export const SOURCES: Record<SourceName, { name: string; credit: string }> = {
  gutenberg: { name: 'Project Gutenberg', credit: 'Metadata from the Project Gutenberg catalog feed.' },
  openlibrary: { name: 'Open Library', credit: 'Metadata from Open Library (Internet Archive). It is not CC0; some records may carry rights issues.' },
};
export const isAccessStatus = (v: string): v is AccessStatus => v in ACCESS;
