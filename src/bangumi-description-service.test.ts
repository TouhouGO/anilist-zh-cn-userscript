import { describe, expect, it } from 'vitest';
import {
  createBangumiDescriptionService,
  formatBangumiSummary,
  searchBangumiSubjectStrict,
} from './bangumi-description-service';
import type { TitleService } from './title-service';

const memory = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: key => void map.delete(key),
    clear: () => void map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

describe('Bangumi description service', () => {
  it('formats Bangumi summary with HTML escaping and mainland Chinese normalization', () => {
    const raw = '第一行簡介 & 測試 <script>\n\n第二行內容：星際牛仔。';
    const formatted = formatBangumiSummary(raw);
    expect(formatted).toBe('<p>第一行简介 &amp; 测试 &lt;script&gt;</p><p>第二行内容：星际牛仔。</p>');
  });

  it('searches Bangumi subjects strictly by native title and release year', async () => {
    const mockRequester = async (url: string) => {
      if (url.includes('Cowboy')) {
        return {
          list: [
            { id: 253, name: 'Cowboy Bebop', name_cn: '星际牛仔', type: 2, air_date: '1998-04-03' },
            { id: 9999, name: 'Cowboy Bebop Movie', name_cn: '星际牛仔 剧场版', type: 2, air_date: '2001-09-01' },
          ],
        };
      }
      return { list: [] };
    };

    const matchedId = await searchBangumiSubjectStrict('Cowboy Bebop', true, 1998, mockRequester);
    expect(matchedId).toBe(253);

    // If ambiguous without exact match, returns undefined
    const ambiguous = await searchBangumiSubjectStrict('Cowboy', true, undefined, mockRequester);
    expect(ambiguous).toBeUndefined();
  });

  it('fetches Chinese summary using explicit Bangumi ID and caches the result', async () => {
    const titleService: Partial<TitleService> = {
      getBangumiId: id => (id === 1 ? 253 : undefined),
    };

    let networkCalls = 0;
    const mockRequester = async (url: string) => {
      networkCalls++;
      if (url === 'https://api.bgm.tv/v0/subjects/253') {
        return {
          id: 253,
          name: 'Cowboy Bebop',
          name_cn: '星際牛仔',
          summary: '2071年的火星，賞金獵人斯派克的故事。',
        };
      }
      return {};
    };

    const storage = memory();
    const service = createBangumiDescriptionService(titleService as TitleService, mockRequester, storage);

    const info1 = await service.getDescription(1);
    expect(info1.bangumiId).toBe(253);
    expect(info1.nameCn).toBe('星际牛仔');
    expect(info1.summary).toBe('<p>2071年的火星，赏金猎人斯派克的故事。</p>');
    expect(networkCalls).toBe(1);

    // Subsequent call should hit cache without network request
    const info2 = await service.getDescription(1);
    expect(info2.summary).toBe(info1.summary);
    expect(networkCalls).toBe(1);
  });

  it('falls back to strict search when media has no explicit Bangumi ID', async () => {
    const titleService: Partial<TitleService> = {
      getBangumiId: () => undefined,
    };

    const mockRequester = async (url: string) => {
      if (url.includes('/search/subject/')) {
        return {
          list: [{ id: 8888, name: 'Original Title', name_cn: '中文标题', type: 2 }],
        };
      }
      if (url.includes('/v0/subjects/8888')) {
        return {
          id: 8888,
          name: 'Original Title',
          name_cn: '中文標題',
          summary: '這是一段簡介。',
        };
      }
      return {};
    };

    const service = createBangumiDescriptionService(titleService as TitleService, mockRequester, memory());
    const info = await service.getDescription(100, { nativeTitle: 'Original Title', isAnime: true });
    expect(info.bangumiId).toBe(8888);
    expect(info.nameCn).toBe('中文标题');
    expect(info.summary).toBe('<p>这是一段简介。</p>');
  });
});
