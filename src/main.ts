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
import { translateDocumentTitle } from './document-title-translator';
import { createBangumiDescriptionService } from './bangumi-description-service';
import { translateDescription } from './description-translator';
import type { EntityMediaContext } from './bangumi-entity-source';
import type { Route } from './types';

function entityContext(route: Route): EntityMediaContext | undefined {
  if (route.section !== 'media' || !route.id || !route.type) return undefined;
  return { mediaId: route.id, mediaType: route.type === 'anime' ? 'ANIME' : 'MANGA' };
}

function boot() {
  const service = createTitleService();
  const tagService = createBangumiTagService();
  const descriptionService = createBangumiDescriptionService(service);
  const diagnostics = createDiagnostics(false);
  const entityTranslator = createEntityNameTranslator(createEntityNameService());
  const chineseSearch = startChineseTitleSearch(service);

  const translateElement = (root: Element, route = parseRoute(location.href)) => {
    translateRoot(root, route);
    translateTitles(root, service);
    void translateBangumiTags(root, tagService);
    void translateDescription(root, route, descriptionService);
    entityTranslator.translate(root, entityContext(route), route.path);
  };

  const syncPage = (route = parseRoute(location.href)) => {
    translateDocumentTitle(route, service);
    if (document.body) {
      translateElement(document.body, route);
      void translateDescription(document.body, route, descriptionService);
    }
    chineseSearch.refresh();
  };

  const onRoute = (route: ReturnType<typeof parseRoute>) => {
    entityTranslator.beginRoute();
    syncPage(route);
    requestAnimationFrame(() => syncPage(parseRoute(location.href)));
  };

  startRouteObserver(onRoute);

  startDomObserver(nodes => {
    const route = parseRoute(location.href);
    for (const node of nodes) translateElement(node, route);
    if (document.body) void translateDescription(document.body, route, descriptionService);
    translateDocumentTitle(route, service);
  });

  startMediaHoverObserver(path => {
    if (document.body) translateFavouriteTooltips(document.body, path, service);
  });

  syncPage();
  requestAnimationFrame(() => syncPage());

  void service.refresh().catch(() => diagnostics.record('title data refresh failed')).then(() => {
    syncPage();
  });

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('显示汉化诊断信息', () => console.info('[AniList zh-CN] unmatched candidates', [...diagnostics.misses]));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
