import { describe, expect, it } from 'vitest';
import { extractMediaId, isMediaOverview, isMediaTab, isTitleLink, syncHoverTitleTarget, translateHoverTitle, translateTitles } from './title-translator';

describe('extractMediaId', () => {
  it('extracts anime and manga IDs', () => {
    expect(extractMediaId('/anime/123/foo')).toEqual({ type: 'anime', id: 123 });
    expect(extractMediaId('/manga/456/bar')).toEqual({ type: 'manga', id: 456 });
  });
  it('recognizes detail navigation tabs and keeps them out of title replacement', () => {
    expect(isMediaTab('/anime/123/characters')).toBe(true);
    expect(isMediaTab('/anime/123/天官赐福')).toBe(false);
    expect(isMediaOverview('/anime/123/天官赐福')).toBe(true);
    expect(isMediaOverview('/anime/123')).toBe(true);
    expect(isMediaOverview('/manga/456')).toBe(true);
    expect(isMediaOverview('/anime/123/天官赐福/characters')).toBe(false);
  });
  it('recognizes a title link inside the current AniList entry-card layout', () => {
    const link = {
      textContent: 'ふらいんぐうぃっち',
      matches: () => false,
      closest: (selector: string) => selector.includes('.entry-card') ? {} : null,
      querySelector: () => null,
    } as unknown as HTMLAnchorElement;
    expect(isTitleLink(link, '/anime/21284/flying-witch/')).toBe(true);
  });
  it('translates titles in medialist table and compact views for anime and manga', () => {
    const service = {
      getTitle: (id: number, fallback: string) => {
        if (id === 1) return '星际牛仔';
        if (id === 30001) return '怪物';
        return fallback;
      },
    };

    // 1. Image thumbnail link in table view
    const imageLink = {
      href: 'https://anilist.co/anime/1/cowboy-bebop',
      textContent: '',
      dataset: {},
      childNodes: [],
      children: [{ nodeName: 'IMG' }],
      childElementCount: 1,
      matches: () => false,
      closest: (selector: string) => selector.includes('.image') ? {} : null,
      querySelector: (selector: string) => selector.includes('img') ? {} : null,
      querySelectorAll: () => [],
    } as unknown as HTMLAnchorElement;

    // 2. Title link in table view: <div class="title"><a href="/anime/1/cowboy-bebop">Cowboy Bebop</a></div>
    const titleTextNode = { nodeType: 3, textContent: 'Cowboy Bebop' } as unknown as Node;
    const titleLink = {
      href: 'https://anilist.co/anime/1/cowboy-bebop',
      textContent: 'Cowboy Bebop',
      dataset: {},
      childNodes: [titleTextNode],
      children: [],
      childElementCount: 0,
      matches: () => false,
      closest: (selector: string) => selector.includes('.title') || selector.includes('.medialist') ? {} : null,
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as HTMLAnchorElement;

    expect(isTitleLink(imageLink, '/anime/1/cowboy-bebop')).toBe(false);
    expect(isTitleLink(titleLink, '/anime/1/cowboy-bebop')).toBe(true);

    const tableRoot = {
      matches: () => false,
      querySelectorAll: (sel: string) => sel.includes('a[href]') ? [imageLink, titleLink] : [],
    } as unknown as Element;

    const translated = translateTitles(tableRoot, service as never);
    expect(translated).toBe(1);
    expect(titleTextNode.textContent).toBe('星际牛仔');
    expect(titleLink.dataset.anilistZhCnTitle).toBe('1');
    expect(titleLink.dataset.anilistZhCnOriginal).toBe('Cowboy Bebop');

    // 3. Compact table view: <span class="title"><a href="/manga/30001/monster">Monster</a></span>
    const mangaTextNode = { nodeType: 3, textContent: 'Monster' } as unknown as Node;
    const mangaLink = {
      href: 'https://anilist.co/manga/30001/monster',
      textContent: 'Monster',
      dataset: {},
      childNodes: [mangaTextNode],
      children: [],
      childElementCount: 0,
      matches: () => false,
      closest: (selector: string) => selector.includes('.title') || selector.includes('.compact') ? {} : null,
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as HTMLAnchorElement;

    expect(isTitleLink(mangaLink, '/manga/30001/monster')).toBe(true);

    const compactRoot = {
      matches: () => false,
      querySelectorAll: (sel: string) => sel.includes('a[href]') ? [mangaLink] : [],
    } as unknown as Element;

    const mangaCount = translateTitles(compactRoot, service as never);
    expect(mangaCount).toBe(1);
    expect(mangaTextNode.textContent).toBe('怪物');
    expect(mangaLink.dataset.anilistZhCnTitle).toBe('1');
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
