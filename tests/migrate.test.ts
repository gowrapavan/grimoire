import { describe, expect, it } from 'vitest';
import { migrateStorage } from '../src/lib/migrate';
const fake = (init: Record<string, string>) => { const m = new Map(Object.entries(init)); return { m, get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
describe('saved data from the old name', () => {
  it('copies marginalia.* to grimoire.* and never overwrites newer data', () => {
    const s = fake({ 'marginalia.shelf.v1': '["1","2"]', 'marginalia.theme': 'dark', 'marginalia.read.5': '3', 'grimoire.theme': 'light', other: 'x' });
    migrateStorage(s);
    expect(s.m.get('grimoire.shelf.v1')).toBe('["1","2"]'); expect(s.m.get('grimoire.read.5')).toBe('3'); expect(s.m.get('grimoire.theme')).toBe('light'); expect(s.m.get('other')).toBe('x'); expect(s.m.get('marginalia.theme')).toBe('dark');
  });
  it('does nothing when storage is blocked', () => { expect(() => migrateStorage({ get length(): number { throw new Error('blocked'); }, key: () => null, getItem: () => null, setItem: () => {} })).not.toThrow(); expect(() => migrateStorage(undefined)).not.toThrow(); });
});
