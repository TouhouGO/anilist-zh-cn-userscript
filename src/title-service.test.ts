import { describe, expect, it } from 'vitest';
import { createTitleService } from './title-service';

const memory = (): Storage => {
  const map = new Map<string, string>();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) } as Storage;
};

describe('title service', () => {
  it('uses overrides before fetched data and falls back when absent', async () => {
    const service = createTitleService(memory(), async () => new Response(JSON.stringify([{ id: 999998, title: '測試標題' }])));
    await service.refresh();
    expect(service.getTitle(1, 'Original')).toBe('星际牛仔');
    expect(service.getTitle(999998, 'Original')).toBe('测试标题');
    expect(service.getTitle(999999, 'Original')).toBe('Original');
  });
  it('finds AniList entries by normalized Chinese title with exact matches first', () => {
    const service = createTitleService(memory(), async () => new Response('[]'));
    const matches = service.searchTitles('葬送的芙莉蓮');
    expect(matches[0]).toMatchObject({ id: 154587, title: '葬送的芙莉莲', native: '葬送のフリーレン' });
    expect(matches.some(item => item.id === 182255 && item.title === '葬送的芙莉莲 第二季')).toBe(true);
  });
  it('does not take over non-Chinese AniList searches', () => {
    const service = createTitleService(memory(), async () => new Response('[]'));
    expect(service.searchTitles('Frieren')).toEqual([]);
    expect(service.searchTitles('葬')).toEqual([]);
  });
});
