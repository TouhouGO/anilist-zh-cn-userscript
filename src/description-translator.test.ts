import { describe, expect, it } from 'vitest';
import type { BangumiDescriptionService } from './bangumi-description-service';
import {
  extractSidebarNativeTitle,
  extractSidebarReleaseYear,
  renderDescriptionHtml,
  translateDescription,
} from './description-translator';
import type { Route } from './types';

describe('description translator', () => {
  it('extracts native title and release year from sidebar data sets', () => {
    const mockRoot = {
      querySelectorAll: (sel: string) => {
        if (sel.includes('.data-set')) {
          return [
            {
              querySelector: (s: string) =>
                s.includes('.type') ? { textContent: 'Native' } : { textContent: 'カウボーイビバップ' },
            },
            {
              querySelector: (s: string) =>
                s.includes('.type') ? { textContent: 'Start Date' } : { textContent: 'Apr 3, 1998' },
            },
          ];
        }
        return [];
      },
    } as unknown as Element;

    expect(extractSidebarNativeTitle(mockRoot)).toBe('カウボーイビバップ');
    expect(extractSidebarReleaseYear(mockRoot)).toBe(1998);
  });

  it('renders bilingual description HTML structure properly', () => {
    const summary = '<p>赏金猎人斯派克的故事。</p>';
    const original = '<p>Original synopsis in English.</p>';
    const html = renderDescriptionHtml(summary, original);

    expect(html).toContain('【剧情简介】');
    expect(html).toContain(summary);
    expect(html).toContain('【原简介】');
    expect(html).toContain(original);
  });

  it('translates description element on media overview route', async () => {
    const attributes = new Map<string, string>();
    const descEl = {
      innerHTML: '<p>Original English synopsis</p>',
      matches: () => true,
      getAttribute: (k: string) => attributes.get(k) ?? null,
      setAttribute: (k: string, v: string) => void attributes.set(k, v),
      hasAttribute: (k: string) => attributes.has(k),
    } as unknown as HTMLElement;

    const mockRoot = {
      matches: () => false,
      querySelector: () => descEl,
      querySelectorAll: () => [],
    } as unknown as Element;

    const mockService: BangumiDescriptionService = {
      getDescription: async (id: number) => {
        if (id === 1) {
          return { summary: '<p>星际牛仔中文剧情简介。</p>', bangumiId: 253 };
        }
        return {};
      },
    };

    const route: Route = {
      section: 'media',
      type: 'anime',
      id: 1,
      path: '/anime/1/cowboy-bebop',
    };

    const success = await translateDescription(mockRoot, route, mockService);
    expect(success).toBe(true);
    expect(descEl.innerHTML).toContain('【剧情简介】');
    expect(descEl.innerHTML).toContain('星际牛仔中文剧情简介');
    expect(descEl.innerHTML).toContain('Original English synopsis');
    expect(attributes.get('data-anilist-zh-cn-desc-id')).toBe('1');

    // Re-running on same route should skip
    const duplicate = await translateDescription(mockRoot, route, mockService);
    expect(duplicate).toBe(false);
  });

  it('ignores sub-tabs such as /characters', async () => {
    const mockService: BangumiDescriptionService = {
      getDescription: async () => ({ summary: 'Test' }),
    };

    const subTabRoute: Route = {
      section: 'media',
      type: 'anime',
      id: 1,
      path: '/anime/1/cowboy-bebop/characters',
    };

    const result = await translateDescription({} as Element, subTabRoute, mockService);
    expect(result).toBe(false);
  });
});
