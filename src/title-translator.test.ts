import { describe, expect, it } from 'vitest';
import { extractMediaId, isMediaOverview, isMediaTab, isTitleLink, syncHoverTitleTarget, translateHoverTitle } from './title-translator';

describe('extractMediaId', () => {
  it('extracts anime and manga IDs', () => {
    expect(extractMediaId('/anime/123/foo')).toEqual({ type: 'anime', id: 123 });
    expect(extractMediaId('/manga/456/bar')).toEqual({ type: 'manga', id: 456 });
  });
  it('recognizes detail navigation tabs and keeps them out of title replacement', () => {
    expect(isMediaTab('/anime/123/characters')).toBe(true);
    expect(isMediaTab('/anime/123/天官赐福')).toBe(false);
    expect(isMediaOverview('/anime/123/天官赐福')).toBe(true);
    expect(isMediaOverview('/anime/123/天官赐福/characters')).toBe(false);
  });
  it('recognizes a title link inside the current AniList entry-card layout', () => {
    const link = {
      textContent: 'ふらいんぐうぃっち',
      matches: () => false,
      closest: (selector: string) => selector.includes('.entry-card') ? {} : null,
    } as unknown as HTMLAnchorElement;
    expect(isTitleLink(link, '/anime/21284/flying-witch/')).toBe(true);
  });
  it('translates a detached favourite tooltip using the hovered media path', () => {
    const service = { getTitle: (id: number, fallback: string) => id === 4720 ? '白色相簿' : fallback };
    expect(translateHoverTitle('WHITE ALBUM', '/anime/4720/WHITE-ALBUM/', service as never)).toBe('白色相簿');
  });
  it('updates a reused tooltip when the hovered favourite changes', () => {
    const service = { getTitle: (id: number, fallback: string) => ({ 4720: '白色相簿', 6165: '白色相簿 下半编章' }[id] || fallback) };
    const target = { textContent: 'WHITE ALBUM', dataset: {} } as unknown as HTMLElement;
    expect(syncHoverTitleTarget(target, '/anime/4720/WHITE-ALBUM/', service as never)).toBe(true);
    expect(target.textContent).toBe('白色相簿');
    expect(syncHoverTitleTarget(target, '/anime/6165/WHITE-ALBUM-2/', service as never)).toBe(true);
    expect(target.textContent).toBe('白色相簿 下半编章');
  });
});
