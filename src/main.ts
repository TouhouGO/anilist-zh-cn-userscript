import { startDomObserver, startMediaHoverObserver } from './observer';
import { parseRoute, startRouteObserver } from './router';
import { translateRoot } from './translator';
import { createTitleService } from './title-service';
import { translateFavouriteTooltips, translateTitles } from './title-translator';
import { createDiagnostics } from './diagnostics';
import { createBangumiTagService } from './bangumi-tag-service';
import { translateBangumiTags } from './translator';
import { startChineseTitleSearch } from './chinese-search';
import { createEntityNameService } from './entity-name-service';
import { createEntityNameTranslator } from './entity-name-translator';
import type { EntityMediaContext } from './bangumi-entity-source';
import type { Route } from './types';

function entityContext(route: Route): EntityMediaContext | undefined {
  if (route.section !== 'media' || !route.id || !route.type) return undefined;
  return { mediaId: route.id, mediaType: route.type === 'anime' ? 'ANIME' : 'MANGA' };
}

function boot() {
  const service = createTitleService(); const tagService = createBangumiTagService(); const diagnostics = createDiagnostics(false);
  const entityTranslator = createEntityNameTranslator(createEntityNameService());
  const chineseSearch = startChineseTitleSearch(service);
  const translate = (root: Element, route = parseRoute(location.href)) => { translateRoot(root, route); translateTitles(root, service); void translateBangumiTags(root, tagService); entityTranslator.translate(root, entityContext(route), route.path); chineseSearch.refresh(); };
  const onRoute = (route: ReturnType<typeof parseRoute>) => { entityTranslator.beginRoute(); if (document.body) translate(document.body, route); };
  startRouteObserver(onRoute); startDomObserver(nodes => { const route = parseRoute(location.href); for (const node of nodes) translate(node, route); });
  startMediaHoverObserver(path => { if (document.body) translateFavouriteTooltips(document.body, path, service); });
  window.setTimeout(() => { if (document.body) translate(document.body); }, 100);
  window.setTimeout(() => { if (document.body) translate(document.body); }, 500);
  void service.refresh().catch(() => diagnostics.record('title data refresh failed')).then(() => { if (document.body) translate(document.body); });
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('显示汉化诊断信息', () => console.info('[AniList zh-CN] unmatched candidates', [...diagnostics.misses]));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
