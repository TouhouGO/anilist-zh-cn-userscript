import type { BangumiDescriptionService } from './bangumi-description-service';
import { isMediaOverview, isMediaTab } from './title-translator';
import type { Route } from './types';

const MARKER_DESC_ID = 'data-anilist-zh-cn-desc-id';
const MARKER_DESC_ORIGINAL = 'data-anilist-zh-cn-desc-original';

export function extractSidebarNativeTitle(root: Element): string | undefined {
  const sets = Array.from(root.querySelectorAll<HTMLElement>('.data-set, .data-item'));
  for (const set of sets) {
    const type = set.querySelector('.type')?.textContent?.trim().toLowerCase();
    if (type === 'native' || type === 'romaji') {
      const val = set.querySelector('.value')?.textContent?.trim();
      if (val) return val;
    }
  }
  return undefined;
}

export function extractSidebarReleaseYear(root: Element): number | undefined {
  const sets = Array.from(root.querySelectorAll<HTMLElement>('.data-set, .data-item'));
  for (const set of sets) {
    const type = set.querySelector('.type')?.textContent?.trim().toLowerCase();
    if (type === 'start date' || type === 'release date' || type === 'season') {
      const val = set.querySelector('.value')?.textContent?.trim();
      if (val) {
        const match = val.match(/\b(19\d{2}|20\d{2})\b/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }
  return undefined;
}

export function renderDescriptionHtml(summaryHtml: string, originalHtml: string): string {
  const divider = '<hr class="anilist-zh-cn-summary-divider" style="margin: 14px 0; border: none; border-top: 1px solid rgba(120, 140, 160, 0.25);">';
  const headingStyle = 'margin-bottom: 8px; font-weight: 700; color: rgb(var(--color-text, 146, 166, 187));';

  if (!originalHtml.trim()) {
    return `<div class="anilist-zh-cn-description-content"><p class="anilist-zh-cn-summary-heading" style="${headingStyle}"><strong>【剧情简介】</strong></p>${summaryHtml}</div>`;
  }

  return [
    '<div class="anilist-zh-cn-description-content">',
    `<p class="anilist-zh-cn-summary-heading" style="${headingStyle}"><strong>【剧情简介】</strong></p>`,
    summaryHtml,
    divider,
    `<p class="anilist-zh-cn-summary-heading" style="${headingStyle}"><strong>【原简介】</strong></p>`,
    `<div class="anilist-zh-cn-original-content">${originalHtml}</div>`,
    '</div>',
  ].join('');
}

export async function translateDescription(
  root: Element,
  route: Route,
  descriptionService: BangumiDescriptionService
): Promise<boolean> {
  if (route.section !== 'media' || !route.id || !route.type) return false;
  if (isMediaTab(route.path) || !isMediaOverview(route.path)) return false;

  const descElement = (root.matches('.description') ? root : root.querySelector<HTMLElement>('.description')) as HTMLElement | null;
  if (!descElement) return false;

  const currentDescId = descElement.getAttribute(MARKER_DESC_ID);
  if (currentDescId === String(route.id)) return false;

  const originalHtml = descElement.getAttribute(MARKER_DESC_ORIGINAL) || descElement.innerHTML;
  if (!descElement.hasAttribute(MARKER_DESC_ORIGINAL)) {
    descElement.setAttribute(MARKER_DESC_ORIGINAL, originalHtml);
  }

  const nativeTitle = extractSidebarNativeTitle(root);
  const releaseYear = extractSidebarReleaseYear(root);

  const info = await descriptionService.getDescription(route.id, {
    isAnime: route.type === 'anime',
    nativeTitle,
    releaseYear,
  });

  if (!info.summary) {
    descElement.setAttribute(MARKER_DESC_ID, String(route.id));
    return false;
  }

  descElement.innerHTML = renderDescriptionHtml(info.summary, originalHtml);
  descElement.setAttribute(MARKER_DESC_ID, String(route.id));
  return true;
}
