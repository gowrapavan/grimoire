export type AccessStatus = 'open_access' | 'borrowable' | 'external_link' | 'metadata_only';
export type SourceName = 'gutenberg' | 'openlibrary';
export interface Book {
  id: string; source: SourceName; sourceId: string; title: string; authors: string[];
  description?: string; language: string; publishYear?: number; accessStatus: AccessStatus;
  subjects: string[]; sourceUrl: string; coverUrl?: string; readUrl?: string; addedAt: string;
}
