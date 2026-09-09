import type { BangumiDescriptionService } from './bangumi-description-service';
import { runWithoutDomObservation } from './observer';
import { isMediaOverview, isMediaTab } from './title-translator';
import type { Route } from './types';

const MARKER_DESC_ID = 'data-anilist-zh-cn-desc-id';
const MARKER_DESC_ORIGINAL = 'data-anilist-zh-cn-desc-original';

export function extractSidebarNativeTitle(root: Element): string | undefined {
  const sets = Array.from(root.querySelectorAll<HTMLElement>('.data-set, .data-item'));
  for (const set of sets) {
    const typeEl = set.querySelector('.type');
    const type = (typeEl?.getAttribute?.('data-anilist-zh-cn-original') || typeEl?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (type === 'native' || type === 'romaji' || type === '原名' || type === '罗马字') {
      const val = set.querySelector('.value')?.textContent?.trim();
      if (val) return val;
    }
  }
  return undefined;
}

export function extractSidebarReleaseYear(root: Element): number | undefined {
  const sets = Array.from(root.querySelectorAll<HTMLElement>('.data-set, .data-item'));
  for (const set of sets) {
    const typeEl = set.querySelector('.type');
    const type = (typeEl?.getAttribute?.('data-anilist-zh-cn-original') || typeEl?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (
      type === 'start date' ||
      type === 'release date' ||
      type === 'season' ||
      type === '开始日期' ||
      type === '播出日期' ||
      type === '季度' ||
      type === '播出季度'
    ) {
      const val = set.querySelector('.value')?.textContent?.trim();
      if (val) {
        const match = val.match(/\b(19\d{2}|20\d{2})\b/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }
  return undefined;
}

export function renderDescriptionHtml(summaryHtml: string, _originalHtml?: string): string {
  const formattedSummary = summaryHtml
    .replace(/<p>/gi, '<span style="display: block; margin-bottom: 8px;">')
    .replace(/<\/p>/gi, '</span>');

  return `<span class="anilist-zh-cn-description-content" style="display: block;">${formattedSummary}</span>`;
}

const inFlightDescriptions = new Set<number>();

export async function translateDescription(
  root: Element,
  route: Route,
  descriptionService: BangumiDescriptionService
): Promise<boolean> {
  if (route.section !== 'media' || !route.id || !route.type) return false;

  const descElement = (
    root.matches?.('.description')
      ? (root as HTMLElement)
      : (root.querySelector?.<HTMLElement>('.description') ?? null)
  );

  if (!descElement) return false;

  const mediaId = route.id;

  // If already rendered with our translated content for this mediaId, do not re-render
  if (descElement.getAttribute?.(MARKER_DESC_ID) === String(mediaId)) {
    return false;
  }
  if (descElement.querySelector?.('.anilist-zh-cn-description-content')) {
    descElement.setAttribute?.(MARKER_DESC_ID, String(mediaId));
    return false;
  }

  // Prevent multiple concurrent fetches for the same mediaId
  if (inFlightDescriptions.has(mediaId)) {
    return false;
  }

  const rawText = descElement.textContent?.trim();
  if (!rawText) return false;

  const originalHtml = descElement.getAttribute?.(MARKER_DESC_ORIGINAL) || descElement.innerHTML;
  if (!descElement.hasAttribute?.(MARKER_DESC_ORIGINAL)) {
    descElement.setAttribute?.(MARKER_DESC_ORIGINAL, originalHtml);
  }

  const queryRoot = typeof document !== 'undefined' ? (document.body || root) : root;
  const nativeTitle = extractSidebarNativeTitle(queryRoot);
  const h1El = queryRoot.querySelector ? queryRoot.querySelector<HTMLElement>('h1') : null;
  const fallbackTitle = h1El?.getAttribute?.('data-anilist-zh-cn-original') || h1El?.textContent?.trim() || undefined;
  const releaseYear = extractSidebarReleaseYear(queryRoot);

  inFlightDescriptions.add(mediaId);
  try {
    const info = await descriptionService.getDescription(mediaId, {
      isAnime: route.type === 'anime',
      nativeTitle: nativeTitle || fallbackTitle,
      releaseYear,
    });

    // Check if route changed during async network fetch
    const currentPath = typeof location !== 'undefined' ? location.pathname : route.path;
    const currentMediaId = currentPath.match(/^\/(?:anime|manga)\/(\d+)/)?.[1];
    if (currentMediaId && currentMediaId !== String(mediaId)) {
      return false;
    }

    descElement.setAttribute?.(MARKER_DESC_ID, String(mediaId));
    if (!info.summary) {
      return false;
    }

    runWithoutDomObservation(() => {
      descElement.innerHTML = renderDescriptionHtml(info.summary!, originalHtml);
    });
    return true;
  } finally {
    inFlightDescriptions.delete(mediaId);
  }
}
