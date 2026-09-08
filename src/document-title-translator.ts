import type { TitleService } from './title-service';
import type { Route } from './types';

const staticTitleMap: Record<string, string> = {
  'AniList': 'AniList',
  'Anime & Manga Recommendations · AniList': '动画与漫画推荐 · AniList',
  'Search Anime · AniList': '搜索动画 · AniList',
  'Search Manga · AniList': '搜索漫画 · AniList',
  'Browse Anime · AniList': '浏览动画 · AniList',
  'Browse Manga · AniList': '浏览漫画 · AniList',
  'Trending Anime · AniList': '热门动画 · AniList',
  'Top 100 Anime · AniList': '动画 Top 100 · AniList',
  'Top 100 Manga · AniList': '漫画 Top 100 · AniList',
  'Forum · AniList': '论坛 · AniList',
  'Notifications · AniList': '通知 · AniList',
  'Settings · AniList': '设置 · AniList',
};

export function getTranslatedTitle(currentTitle: string, route: Route, service: TitleService): string | undefined {
  if (!currentTitle) return undefined;

  // 1. Check static known titles
  if (staticTitleMap[currentTitle]) {
    return staticTitleMap[currentTitle];
  }

  // 2. Media page title: "[Media Title] · AniList"
  if (route.section === 'media' && route.id) {
    const match = currentTitle.match(/^(.*?)\s*·\s*AniList$/);
    if (match) {
      const original = match[1].trim();
      const chinese = service.getTitle(route.id, original);
      if (chinese && chinese !== original) {
        return `${chinese} · AniList`;
      }
    }
  }

  // 3. User page titles: "[User]'s Profile · AniList", "[User]'s Anime List · AniList", etc.
  const userProfileMatch = currentTitle.match(/^(.*?)'s\s+Profile\s*·\s*AniList$/);
  if (userProfileMatch) {
    return `${userProfileMatch[1]} 的个人资料 · AniList`;
  }
  const userAnimeMatch = currentTitle.match(/^(.*?)'s\s+Anime\s+List\s*·\s*AniList$/);
  if (userAnimeMatch) {
    return `${userAnimeMatch[1]} 的动画列表 · AniList`;
  }
  const userMangaMatch = currentTitle.match(/^(.*?)'s\s+Manga\s+List\s*·\s*AniList$/);
  if (userMangaMatch) {
    return `${userMangaMatch[1]} 的漫画列表 · AniList`;
  }

  return undefined;
}

export function translateDocumentTitle(route: Route, service: TitleService, targetDoc?: { title: string }): boolean {
  const doc = targetDoc || (typeof document !== 'undefined' ? document : undefined);
  if (!doc) return false;
  const next = getTranslatedTitle(doc.title, route, service);
  if (next && next !== doc.title) {
    doc.title = next;
    return true;
  }
  return false;
}
