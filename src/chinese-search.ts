import type { TitleService } from './title-service';
import { createMediaCoverService, type MediaCoverService } from './media-cover-service';

export type SearchMediaType = 'anime' | 'manga';
export type ChineseSearchItem = { id: number; href: string; title: string; native?: string };
export type QuickSearchItem = ChineseSearchItem & { type: SearchMediaType };
export type QuickSearchRow = QuickSearchItem & { image?: string; info: string };

const PANEL_ID = 'anilist-zh-cn-search-matches';
const QUICK_PANEL_ID = 'anilist-zh-cn-quick-search-matches';
const STYLE_ID = 'anilist-zh-cn-search-style';

export function getSearchMediaType(input: string): SearchMediaType | undefined {
  const path = new URL(input, 'https://anilist.co').pathname.replace(/\/+$/, '');
  if (path === '/search/anime') return 'anime';
  if (path === '/search/manga') return 'manga';
  return undefined;
}

export function buildChineseSearchItems(query: string, type: SearchMediaType, service: TitleService): ChineseSearchItem[] {
  return service.searchTitles(query).map(item => ({ ...item, href: `/${type}/${item.id}/` }));
}

export function buildQuickSearchItems(query: string, service: TitleService): QuickSearchItem[] {
  return service.searchTitles(query).map(item => {
    const type = item.type || 'anime';
    return { ...item, type, href: `/${type}/${item.id}/` };
  });
}

export function mergeQuickSearchRows(items: QuickSearchItem[], nativeCovers: ReadonlyMap<number, string>, fetchedCovers: ReadonlyMap<number, string> = new Map()): QuickSearchRow[] {
  return items.map(item => ({
    ...item,
    image: nativeCovers.get(item.id) || fetchedCovers.get(item.id),
    info: `${item.native || item.title} · ${item.type === 'anime' ? '动画' : '漫画'}`,
  }));
}

function collectNativeCovers(quickSearch: Element): Map<number, string> {
  const covers = new Map<number, string>();
  for (const link of quickSearch.querySelectorAll<HTMLAnchorElement>('.result-col a[href*="/anime/"], .result-col a[href*="/manga/"]')) {
    const id = Number(link.getAttribute('href')?.match(/\/(?:anime|manga)\/(\d+)/)?.[1]);
    const background = link.querySelector<HTMLElement>('.image')?.style.backgroundImage || '';
    const image = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (Number.isInteger(id) && image) covers.set(id, image);
  }
  return covers;
}

function ensureStyle(root: Document): void {
  if (root.getElementById(STYLE_ID)) return;
  const style = root.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${PANEL_ID}{margin:32px 0 40px}
#${PANEL_ID} .anilist-zh-cn-search-heading{align-items:center;color:rgb(var(--color-text));display:flex;font-size:1.4rem;font-weight:700;gap:10px;margin:0 0 16px}
#${PANEL_ID} .anilist-zh-cn-search-count{background:rgb(var(--color-blue));border-radius:12px;color:#fff;font-size:.72rem;padding:3px 8px}
#${PANEL_ID} .anilist-zh-cn-search-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
#${PANEL_ID} .anilist-zh-cn-search-item{background:rgb(var(--color-foreground));border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:7px;min-height:74px;padding:15px 17px;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
#${PANEL_ID} .anilist-zh-cn-search-item:hover{box-shadow:0 5px 16px rgba(0,0,0,.12);transform:translateY(-2px)}
#${PANEL_ID} .anilist-zh-cn-search-title{color:rgb(var(--color-blue));font-size:1rem;font-weight:700;line-height:1.35}
#${PANEL_ID} .anilist-zh-cn-search-native{color:rgb(var(--color-text-lighter));font-size:.78rem;line-height:1.3}
#${QUICK_PANEL_ID}{background:rgb(var(--color-foreground));border-radius:4px;display:block;position:relative}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-heading{color:rgb(237,241,245);font-size:14px;font-weight:600;left:0;line-height:16px;margin:0;position:absolute;top:-28px}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-result{height:65px;padding:15px 20px 10px;transition:background .15s ease}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-result:first-of-type{border-radius:4px 4px 0 0}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-result:last-child{border-radius:0 0 4px 4px}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-result:hover{background:rgb(var(--color-background-200))}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-item{color:rgb(var(--color-text));display:grid;font-size:15px;font-weight:600;grid-template-columns:40px minmax(0,1fr);height:40px;line-height:17.25px;text-decoration:none}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-image{background-position:center;background-size:cover;border-radius:3px;height:40px;width:40px}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-image.placeholder{background:linear-gradient(135deg,rgb(var(--color-background-300)),rgb(var(--color-background-500)))}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-name{overflow:hidden;padding:0 10px;text-overflow:ellipsis;white-space:nowrap}
#${QUICK_PANEL_ID} .anilist-zh-cn-quick-info{color:rgb(var(--color-text-lighter));font-size:12px;font-weight:500;line-height:13.8px;overflow:hidden;padding-top:3px;text-overflow:ellipsis;white-space:nowrap}
`;
  root.head.append(style);
}

export function renderChineseTitleSearch(root: Document, service: TitleService): number {
  const type = getSearchMediaType(root.location.href);
  const input = root.querySelector<HTMLInputElement>('.search-page input.search, input.search');
  const previous = root.getElementById(PANEL_ID);
  if (!type || !input) { previous?.remove(); return 0; }
  const items = buildChineseSearchItems(input.value, type, service);
  if (!items.length) { previous?.remove(); return 0; }
  const signature = `${type}:${input.value}:${items.map(item => item.id).join(',')}`;
  if (previous?.dataset.signature === signature && previous.isConnected) return items.length;

  ensureStyle(root);
  const panel = previous || root.createElement('section');
  panel.id = PANEL_ID;
  panel.dataset.signature = signature;
  panel.replaceChildren();
  const heading = root.createElement('h3');
  heading.className = 'anilist-zh-cn-search-heading';
  heading.append('中文标题匹配');
  const count = root.createElement('span');
  count.className = 'anilist-zh-cn-search-count';
  count.textContent = String(items.length);
  heading.append(count);
  const grid = root.createElement('div');
  grid.className = 'anilist-zh-cn-search-grid';
  for (const item of items) {
    const link = root.createElement('a');
    link.className = 'anilist-zh-cn-search-item';
    link.href = item.href;
    const title = root.createElement('span');
    title.className = 'anilist-zh-cn-search-title';
    title.textContent = item.title;
    link.append(title);
    if (item.native && item.native !== item.title) {
      const native = root.createElement('span');
      native.className = 'anilist-zh-cn-search-native';
      native.textContent = item.native;
      link.append(native);
    }
    grid.append(link);
  }
  panel.append(heading, grid);
  const searchPage = root.querySelector('.search-page');
  const nativeResults = searchPage?.querySelector('.results');
  const landing = searchPage?.querySelector('.landing');
  const anchor = nativeResults || landing;
  const host = anchor?.parentElement || searchPage;
  if (host) host.insertBefore(panel, anchor || null);
  return items.length;
}

function renderQuickTitleSearch(root: Document, service: TitleService, fetchedCovers: ReadonlyMap<number, string> = new Map()): number {
  const quickSearch = root.querySelector('.quick-search.visible');
  const input = quickSearch?.querySelector<HTMLInputElement>('input[type="text"]');
  const previous = root.getElementById(QUICK_PANEL_ID);
  if (!quickSearch || !input) { previous?.remove(); return 0; }
  const items = buildQuickSearchItems(input.value, service);
  if (!items.length) { previous?.remove(); return 0; }
  const rows = mergeQuickSearchRows(items, collectNativeCovers(quickSearch), fetchedCovers);
  const signature = `${input.value}:${rows.map(item => `${item.type}:${item.id}:${item.image || ''}`).join(',')}`;
  if (previous?.dataset.signature === signature && previous.isConnected) return items.length;

  ensureStyle(root);
  const panel = previous || root.createElement('section');
  panel.id = QUICK_PANEL_ID;
  panel.dataset.signature = signature;
  panel.replaceChildren();
  const heading = root.createElement('h3');
  heading.className = 'anilist-zh-cn-quick-heading';
  heading.textContent = '中文标题匹配';
  for (const item of rows.slice(0, 8)) {
    const result = root.createElement('div');
    result.className = 'anilist-zh-cn-quick-result';
    const link = root.createElement('a');
    link.className = 'anilist-zh-cn-quick-item';
    link.href = item.href;
    const image = root.createElement('div');
    image.className = `anilist-zh-cn-quick-image${item.image ? '' : ' placeholder'}`;
    if (item.image) image.style.backgroundImage = `url("${item.image}")`;
    const name = root.createElement('div');
    name.className = 'anilist-zh-cn-quick-name';
    name.append(item.title);
    const info = root.createElement('div');
    info.className = 'anilist-zh-cn-quick-info';
    info.textContent = item.info;
    name.append(info);
    link.append(image, name);
    result.append(link);
    panel.append(result);
  }
  panel.prepend(heading);
  const results = quickSearch.querySelector('.results');
  if (results) results.prepend(panel);
  return items.length;
}

type SearchRoot = Pick<Document, 'addEventListener' | 'removeEventListener'>;
type Schedule = (callback: () => void, delay: number) => unknown;

export function startChineseTitleSearch(service: TitleService, root: Document = document, schedule: Schedule = setTimeout, coverService: MediaCoverService = createMediaCoverService()): { refresh(): void; stop(): void } {
  let generation = 0;
  const fetchedCovers = new Map<number, string>();
  const refresh = () => {
    const current = ++generation;
    schedule(() => {
      if (current !== generation) return;
      renderChineseTitleSearch(root, service);
      renderQuickTitleSearch(root, service, fetchedCovers);
      const quickSearch = root.querySelector('.quick-search.visible');
      const input = quickSearch?.querySelector<HTMLInputElement>('input[type="text"]');
      if (!quickSearch || !input) return;
      const query = input.value;
      const nativeCovers = collectNativeCovers(quickSearch);
      const missing = buildQuickSearchItems(query, service).slice(0, 8).map(item => item.id).filter(id => !nativeCovers.has(id) && !fetchedCovers.has(id));
      if (!missing.length) return;
      void coverService.load(missing).then(covers => {
        for (const [id, image] of covers) fetchedCovers.set(id, image);
        const activeInput = root.querySelector<HTMLInputElement>('.quick-search.visible input[type="text"]');
        if (activeInput?.value === query) renderQuickTitleSearch(root, service, fetchedCovers);
      }).catch(() => { /* keep placeholders when AniList cover lookup is unavailable */ });
    }, 120);
  };
  const onInput = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.matches?.('.search-page input.search, input.search, .quick-search input[type="text"]')) refresh();
  };
  const eventRoot: SearchRoot = root;
  eventRoot.addEventListener('input', onInput as EventListener, true);
  refresh();
  return { refresh, stop() { generation++; eventRoot.removeEventListener('input', onInput as EventListener, true); } };
}
