import { describe, expect, it } from 'vitest';
import { translateDocumentTitle } from './document-title-translator';

describe('translateDocumentTitle', () => {
  it('translates static AniList page titles', () => {
    const doc = { title: 'Anime & Manga Recommendations · AniList' };
    expect(translateDocumentTitle({ section: 'other', path: '/recommendations' }, {} as never, doc)).toBe(true);
    expect(doc.title).toBe('动画与漫画推荐 · AniList');

    doc.title = 'Search Anime · AniList';
    expect(translateDocumentTitle({ section: 'search', path: '/search/anime' }, {} as never, doc)).toBe(true);
    expect(doc.title).toBe('搜索动画 · AniList');
  });

  it('translates media detail page titles using TitleService', () => {
    const doc = { title: 'Nisekoi · AniList' };
    const fakeService = {
      getTitle: (id: number, fallback: string) => id === 18897 ? '伪恋' : fallback,
    };
    expect(translateDocumentTitle({ section: 'media', path: '/anime/18897/Nisekoi', id: 18897, type: 'anime' }, fakeService as never, doc)).toBe(true);
    expect(doc.title).toBe('伪恋 · AniList');
  });

  it('translates media detail page with brackets/sub-names', () => {
    const doc = { title: 'Kanojo mo Kanojo (Girlfriend, Girlfriend) · AniList' };
    const fakeService = {
      getTitle: (id: number, fallback: string) => id === 126192 ? '女朋友 and 女朋友' : fallback,
    };
    expect(translateDocumentTitle({ section: 'media', path: '/anime/126192/Kanojo-mo-Kanojo', id: 126192, type: 'anime' }, fakeService as never, doc)).toBe(true);
    expect(doc.title).toBe('女朋友 and 女朋友 · AniList');
  });

  it('translates user profiles and user lists', () => {
    const doc = { title: "Josh's Profile · AniList" };
    expect(translateDocumentTitle({ section: 'profile', path: '/user/Josh' }, {} as never, doc)).toBe(true);
    expect(doc.title).toBe("Josh 的个人资料 · AniList");

    doc.title = "Josh's Anime List · AniList";
    expect(translateDocumentTitle({ section: 'list', path: '/user/Josh/animelist' }, {} as never, doc)).toBe(true);
    expect(doc.title).toBe("Josh 的动画列表 · AniList");
  });
});
