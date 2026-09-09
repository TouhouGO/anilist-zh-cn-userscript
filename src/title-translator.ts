import type { TitleService } from './title-service';
export function extractMediaId(path: string): { type: 'anime' | 'manga'; id: number } | undefined { const match = path.match(/^\/(anime|manga)\/(\d+)/); return match ? { type: match[1] as 'anime' | 'manga', id: Number(match[2]) } : undefined; }
const detailTabs = new Set(['overview', 'watch', 'characters', 'staff', 'reviews', 'stats', 'social', 'relations', 'recommendations']);
const detailTabLabels = new Set(['Overview', 'Watch', 'Characters', 'Staff', 'Reviews', 'Stats', 'Social', 'Relations', 'Recommendations']);
export function isMediaTab(path: string): boolean { const parts = path.split('/').filter(Boolean); return parts.length >= 3 && detailTabs.has(parts[2].toLowerCase()); }
export function isMediaOverview(path: string): boolean {
  const parts = path.split('/').filter(Boolean);
  return Boolean(extractMediaId(path) && (parts.length === 2 || (parts.length === 3 && !detailTabs.has(parts[2].toLowerCase()))));
}

export function isTitleLink(link: HTMLAnchorElement, path: string): boolean {
  if (isMediaTab(path)) return false;
  if (detailTabLabels.has(link.textContent?.trim() || '')) return false;
  if (link.closest('.nav, .tabs, .media-tabs, .footer, .breadcrumb')) return false;
  if (link.closest('.cover, .image') && !link.matches('.title, .title-link, [class*="title"]') && !link.closest('.overlay, .title-wrap')) return false;
  if (link.querySelector('img') && !link.textContent?.trim()) return false;
  return Boolean(
    link.matches('.title, .title-link, [class*="title"], .media-card a, .media-preview-card a, .recommendation-card a, .list-row a, .status a, h1 a, .entry a, .medialist a') ||
    link.closest('.entry-card, .media-card, .media-preview-card, .recommendation-card, .list-row, .status, .medialist, .entry, .title, .lists, .list-entries')
  );
}

export function translateHoverTitle(original: string, hoveredPath: string | undefined, service: TitleService): string {
  const media = hoveredPath ? extractMediaId(hoveredPath) : undefined;
  return media ? service.getTitle(media.id, original) : original;
}

export function syncHoverTitleTarget(target: HTMLElement, hoveredPath: string | undefined, service: TitleService): boolean {
  const original = target.textContent?.trim();
  const media = hoveredPath ? extractMediaId(hoveredPath) : undefined;
  if (!original || !media) return false;
  const title = service.getTitle(media.id, original);
  target.dataset.anilistZhCnHoverMediaId = String(media.id);
  if (title === original) return false;
  target.textContent = title;
  return true;
}

export function translateFavouriteTooltips(root: Element, hoveredPath: string | undefined, service: TitleService): number {
  let count = 0;
  const targets = [
    root.matches('.tooltip.visible .title') ? root : null,
    ...Array.from(root.querySelectorAll<HTMLElement>('.tooltip.visible .title'))
  ].filter(Boolean) as HTMLElement[];
  for (const target of targets) if (syncHoverTitleTarget(target, hoveredPath, service)) count++;
  return count;
}

export function translateTitles(root: Element, service: TitleService): number {
  let count = 0;
  for (const link of [
    root.matches('a[href]') ? root : null,
    ...Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'))
  ].filter(Boolean) as HTMLAnchorElement[]) {
    const origin = typeof location !== 'undefined' ? location.origin : 'https://anilist.co';
    const path = new URL(link.href, origin).pathname;
    const media = extractMediaId(path);
    if (!media) continue;

    const titleTarget = link.querySelector<HTMLElement>('.title, .title-link, [class*="title"]')
      || (link.children.length === 1 && !link.querySelector('img') ? (link.firstElementChild as HTMLElement) : undefined);
    const text = [...link.childNodes].find(node => node.nodeType === 3 && node.textContent?.trim());

    if (!isTitleLink(link, path)) {
      if (link.dataset.anilistZhCnTitle && link.dataset.anilistZhCnOriginal) {
        const restoreTarget = titleTarget || text || link;
        restoreTarget.textContent = link.dataset.anilistZhCnOriginal;
        delete link.dataset.anilistZhCnTitle;
        delete link.dataset.anilistZhCnOriginal;
        delete link.dataset.anilistZhCnMediaId;
      }
      continue;
    }

    const currentText = (titleTarget?.textContent || text?.textContent || link.textContent || '').trim();
    if (!currentText) continue;

    const original = (link.dataset.anilistZhCnMediaId === String(media.id) && link.dataset.anilistZhCnOriginal)
      ? link.dataset.anilistZhCnOriginal
      : currentText;

    const title = service.getTitle(media.id, original);
    if (title === original) continue;
    if (link.dataset.anilistZhCnMediaId === String(media.id) && currentText === title) continue;

    const target = titleTarget || text || link;
    link.dataset.anilistZhCnMediaId = String(media.id);
    link.dataset.anilistZhCnTitle = '1';
    link.dataset.anilistZhCnOriginal = original;
    if (target.nodeType === 3) target.textContent = target.textContent!.replace(currentText, title);
    else target.textContent = title;
    count++;
  }

  const origin = typeof location !== 'undefined' ? location.origin : 'https://anilist.co';
  const currentPath = typeof location !== 'undefined' ? location.pathname : '/';
  const currentMedia = isMediaOverview(currentPath) ? extractMediaId(currentPath) : undefined;
  if (currentMedia) {
    for (const heading of Array.from(root.querySelectorAll<HTMLElement>('h1'))) {
      if (heading.dataset.anilistZhCnTitle) continue;
      const original = heading.textContent?.trim();
      if (!original) continue;
      const title = service.getTitle(currentMedia.id, original);
      if (title === original) continue;
      heading.dataset.anilistZhCnTitle = '1';
      heading.dataset.anilistZhCnOriginal = original;
      heading.textContent = title;
      count++;
    }
  }

  const hovered = typeof document !== 'undefined'
    ? document.querySelector<HTMLAnchorElement>('a.favourite.media:hover[href^="/anime/"], a.favourite.media:hover[href^="/manga/"]')
    : null;
  const hoveredPath = hovered ? new URL(hovered.href, origin).pathname : undefined;
  count += translateFavouriteTooltips(root, hoveredPath, service);
  return count;
}
