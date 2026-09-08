import { uiZhCN } from './data/ui-zh-CN';
import { tagZhCN } from './data/tag-zh-CN';
import { bangumiTagZhCN } from './data/tag-bangumi-zh-CN';
import { protectedSelectors } from './selectors';
import type { Route, TranslationContext } from './types';
import type { BangumiTagService } from './bangumi-tag-service';

const marker = 'data-anilist-zh-cn-original';
export function isProtected(element: Element): boolean { return protectedSelectors.some(selector => Boolean(element.closest(selector))); }
const sectionCache = new Map<string, { exact: Record<string, string>; lower: Map<string, string> }>();
const monthMap: Record<string, string> = {
  Jan: '1月', Feb: '2月', Mar: '3月', Apr: '4月', May: '5月', Jun: '6月',
  Jul: '7月', Aug: '8月', Sep: '9月', Oct: '10月', Nov: '11月', Dec: '12月'
};

function getSectionDictionaries(section: string) {
  let cached = sectionCache.get(section);
  if (!cached) {
    const shared = section === 'list' || section === 'profile' || section === 'media' ? uiZhCN.search : {};
    const tags = section === 'list' || section === 'search' || section === 'media'
      ? { ...tagZhCN, ...bangumiTagZhCN }
      : {};
    const exact = { ...uiZhCN.global, ...shared, ...tags, ...(uiZhCN[section] || {}) };
    const lower = new Map<string, string>();
    for (const [k, v] of Object.entries(exact)) {
      lower.set(k.toLowerCase(), v);
    }
    cached = { exact, lower };
    sectionCache.set(section, cached);
  }
  return cached;
}
function translateDynamic(trimmed: string, _section: string): string | undefined {
  let match = trimmed.match(/^Watched episode (.+) of$/); if (match) return `看完第 ${match[1]} 集，共`;
  match = trimmed.match(/^Ep (\d+)$/); if (match) return `第 ${match[1]} 集`;
  match = trimmed.match(/^Progress:\s*(.+)$/); if (match) return `进度：${match[1]}`;
  match = trimmed.match(/^(\d+) episodes? behind$/); if (match) return `落后 ${match[1]} 集`;
  match = trimmed.match(/^(\d+)d(?:\s+(\d+)h)?(?:\s+(\d+)m)?$/); if (match) return `${match[1]}天${match[2] ? ` ${match[2]}小时` : ''}${match[3] ? ` ${match[3]}分钟` : ''}`;

  match = trimmed.match(/^Ep (\d+) airing in (\d+) days?$/);
  if (match) return `第 ${match[1]} 集，将于 ${match[2]} 天后播出`;
  match = trimmed.match(/^Ep (\d+) airing in 1 day$/);
  if (match) return `第 ${match[1]} 集，将于 1 天后播出`;
  match = trimmed.match(/^TV Show • (\d+) episodes?$/);
  if (match) return `电视动画 · ${match[1]} 集`;

  // Rankings badge, e.g. "#93 Highest Rated 2009", "#32 Most Popular 2009", "#1 Highest Rated All Time"
  match = trimmed.match(/^#(\d+)\s+(Highest Rated|Most Popular)(?:\s+(\d{4}|All Time))?$/i);
  if (match) {
    const rank = match[1];
    const typeStr = match[2].toLowerCase() === 'highest rated' ? '评分最高' : '最高人气';
    const scope = match[3] ? (match[3] === 'All Time' ? '历史' : `${match[3]}年 `) : '';
    return `#${rank} ${scope}${typeStr}`;
  }

  // English dates, e.g. "Jan 4, 2009", "Mar 29, 2009"
  match = trimmed.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})$/);
  if (match) {
    return `${match[3]}年${monthMap[match[1]]}${match[2]}日`;
  }

  // Relations format + status, e.g. "TV · Finished", "Manga · Finished", "TV • Releasing"
  match = trimmed.match(/^(TV|TV Short|Movie|Special|OVA|ONA|Manga|Light Novel|Visual Novel|Novel|Doujinshi)\s*[·•]\s*(Finished|Releasing|Not Yet Released|Cancelled)$/i);
  if (match) {
    const formatMap: Record<string, string> = {
      tv: '电视动画',
      'tv short': '电视短片',
      movie: '电影',
      special: '特别篇',
      ova: 'OVA',
      ona: 'ONA',
      manga: '漫画',
      'light novel': '轻小说',
      'visual novel': '视觉小说',
      novel: '小说',
      doujinshi: '同人志',
    };
    const statusMap: Record<string, string> = {
      finished: '已完结',
      releasing: '连载中',
      'not yet released': '尚未发布',
      cancelled: '已取消',
    };
    const fmt = formatMap[match[1].toLowerCase()] || match[1];
    const stat = statusMap[match[2].toLowerCase()] || match[2];
    return `${fmt} · ${stat}`;
  }

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

export function translateText(value: string, context: TranslationContext): string {
  const trimmed = value.trim();
  const { exact, lower } = getSectionDictionaries(context.section);
  const translated = exact[trimmed] || lower.get(trimmed.toLowerCase()) || translateDynamic(trimmed, context.section);
  return translated ? value.replace(trimmed, translated) : value;
}
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
