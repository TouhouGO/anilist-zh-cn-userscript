import { uiZhCN } from './data/ui-zh-CN';
import { tagZhCN } from './data/tag-zh-CN';
import { bangumiTagZhCN } from './data/tag-bangumi-zh-CN';
import { protectedSelectors } from './selectors';
import type { Route, TranslationContext } from './types';
import type { BangumiTagService } from './bangumi-tag-service';

const marker = 'data-anilist-zh-cn-original';
export function isProtected(element: Element): boolean { return protectedSelectors.some(selector => Boolean(element.closest(selector))); }
function dictionary(context: TranslationContext) {
  const shared = context.section === 'list' || context.section === 'profile' ? uiZhCN.search : {};
  const tags = context.section === 'list' || context.section === 'search' || context.section === 'media'
    ? { ...tagZhCN, ...bangumiTagZhCN }
    : {};
  return { ...uiZhCN.global, ...shared, ...tags, ...(uiZhCN[context.section] || {}) };
}
function translateDynamic(trimmed: string, section: string): string | undefined {
  if (section === 'home') {
    let match = trimmed.match(/^Watched episode (.+) of$/); if (match) return `看完第 ${match[1]} 集，共`;
    match = trimmed.match(/^Ep (\d+)$/); if (match) return `第 ${match[1]} 集`;
    match = trimmed.match(/^Progress:\s*(.+)$/); if (match) return `进度：${match[1]}`;
    match = trimmed.match(/^(\d+) episodes? behind$/); if (match) return `落后 ${match[1]} 集`;
    match = trimmed.match(/^(\d+)d(?:\s+(\d+)h)?(?:\s+(\d+)m)?$/); if (match) return `${match[1]}天${match[2] ? ` ${match[2]}小时` : ''}${match[3] ? ` ${match[3]}分钟` : ''}`;
  }
  let match = trimmed.match(/^Ep (\d+) airing in (\d+) days?$/);
  if (match) return `第 ${match[1]} 集，将于 ${match[2]} 天后播出`;
  match = trimmed.match(/^Ep (\d+) airing in 1 day$/);
  if (match) return `第 ${match[1]} 集，将于 1 天后播出`;
  match = trimmed.match(/^TV Show • (\d+) episodes?$/);
  if (match) return `电视动画 · ${match[1]} 集`;
  match = trimmed.match(/^(Spring|Summer|Fall|Winter) (\d{4})$/);
  if (match) return `${match[2]}年${({ Spring: '春季', Summer: '夏季', Fall: '秋季', Winter: '冬季' } as Record<string, string>)[match[1]]}`;
  match = trimmed.match(/^(\d+) mins?$/);
  if (match) return `${match[1]} 分钟`;
  match = trimmed.match(/^(\d+) hours?, (\d+) mins?$/);
  if (match) return `${match[1]} 小时 ${match[2]} 分钟`;
  match = trimmed.match(/^(\d+) Users$/);
  if (match) return `${match[1]} 名用户`;
  const time = trimmed.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s? ago$/);
  if (time) return `${time[1]} ${({ second: '秒', minute: '分钟', hour: '小时', day: '天', week: '周', month: '个月', year: '年' } as Record<string, string>)[time[2]]}前`;
  if (trimmed === 'Just now') return '刚刚';
  return undefined;
}
export function translateText(value: string, context: TranslationContext): string { const trimmed = value.trim(); const translated = dictionary(context)[trimmed] || translateDynamic(trimmed, context.section); return translated ? value.replace(trimmed, translated) : value; }
export function translateRoot(root: Element, route: Route): number {
  let count = 0; const context = { section: route.section, element: root };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes: Text[] = []; let node: Node | null;
  while ((node = walker.nextNode())) { const text = node as Text; if (!text.data.trim() || isProtected(text.parentElement!)) continue; nodes.push(text); }
  for (const text of nodes) { const next = translateText(text.data, context); if (next !== text.data) { text.parentElement?.setAttribute(marker, text.data); text.data = next; count++; } }
  for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) { if (isProtected(element)) continue; for (const attr of ['placeholder', 'title', 'aria-label']) { const value = element.getAttribute(attr); if (!value || element.hasAttribute(`${marker}-${attr}`)) continue; const next = translateText(value, context); if (next !== value) { element.setAttribute(`${marker}-${attr}`, value); element.setAttribute(attr, next); count++; } } }
  return count;
}

export async function translateBangumiTags(root: Element, service: BangumiTagService): Promise<number> {
  const match = location.pathname.match(/^\/(?:anime|manga)\/(\d+)/); if (!match) return 0;
  const map = await service.loadForAniList(Number(match[1])); let count = 0;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('a'))) {
    const original = element.getAttribute('data-anilist-bangumi-tag-original') || element.textContent?.trim();
    if (!original || !map[original]) continue;
    if (!element.hasAttribute('data-anilist-bangumi-tag-original')) element.setAttribute('data-anilist-bangumi-tag-original', original);
    if (element.textContent?.trim() !== map[original]) { element.textContent = map[original]; count++; }
  }
  return count;
}
