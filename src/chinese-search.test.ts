import { describe, expect, it } from 'vitest';
import { buildChineseSearchItems, buildQuickSearchItems, getSearchMediaType, mergeQuickSearchRows } from './chinese-search';
import type { TitleService } from './title-service';

const service = {
  getTitle: (_id: number, fallback: string) => fallback,
  refresh: async () => {},
  searchTitles: () => [
    { id: 154587, title: '葬送的芙莉莲', native: '葬送のフリーレン' },
    { id: 182255, title: '葬送的芙莉莲 第二季', native: '葬送のフリーレン 第2期' },
  ],
} satisfies TitleService;

describe('Chinese title search', () => {
  it('builds direct AniList links while keeping Chinese result titles', () => {
    expect(buildChineseSearchItems('葬送的芙莉莲', 'anime', service)).toEqual([
      { id: 154587, href: '/anime/154587/', title: '葬送的芙莉莲', native: '葬送のフリーレン' },
      { id: 182255, href: '/anime/182255/', title: '葬送的芙莉莲 第二季', native: '葬送のフリーレン 第2期' },
    ]);
  });
  it('activates only on anime and manga search roots', () => {
    expect(getSearchMediaType('/search/anime')).toBe('anime');
    expect(getSearchMediaType('/search/manga?search=测试')).toBe('manga');
    expect(getSearchMediaType('/search/staff')).toBeUndefined();
  });
  it('builds Chinese matches for the global quick-search overlay', () => {
    expect(buildQuickSearchItems('葬送的芙莉莲', service)).toEqual([
      { id: 154587, href: '/anime/154587/', title: '葬送的芙莉莲', native: '葬送のフリーレン', type: 'anime' },
      { id: 182255, href: '/anime/182255/', title: '葬送的芙莉莲 第二季', native: '葬送のフリーレン 第2期', type: 'anime' },
    ]);
  });
  it('reuses native cover art while keeping Chinese titles and original-title metadata', () => {
    const items = buildQuickSearchItems('葬送的芙莉莲', service);
    expect(mergeQuickSearchRows(items, new Map([[154587, 'https://img.example/frieren.jpg']]))).toEqual([
      { ...items[0], image: 'https://img.example/frieren.jpg', info: '葬送のフリーレン · 动画' },
      { ...items[1], image: undefined, info: '葬送のフリーレン 第2期 · 动画' },
    ]);
  });
  it('uses fetched covers when the native quick-search has no matching AniList ID', () => {
    const items = buildQuickSearchItems('葬送的芙莉莲', service);
    const rows = mergeQuickSearchRows(items, new Map(), new Map([[154587, 'https://img.example/fetched.jpg']]));
    expect(rows[0].image).toBe('https://img.example/fetched.jpg');
  });
});
