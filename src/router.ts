import type { Route, Section } from './types';

export function parseRoute(input: string): Route {
  const url = new URL(input, 'https://anilist.co');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  let section: Section = 'other';
  if (parts[0] === 'home' || !parts.length) section = 'home';
  else if (parts[0] === 'search') section = 'search';
  else if (parts[0] === 'anime' || parts[0] === 'manga') section = 'media';
  else if (parts[0] === 'user' && parts[2]?.match(/list$/)) section = 'list';
  else if (parts[0] === 'user') section = 'profile';
  else if (parts[0] === 'settings') section = 'settings';
  else if (parts[0] === 'forum') section = 'forum';
  else if (parts[0] === 'notifications') section = 'notifications';
  const route: Route = { section, path };
  if (section === 'media') { route.type = parts[0] as 'anime' | 'manga'; route.id = Number(parts[1]); }
  return route;
}

export function startRouteObserver(onRoute: (next: Route, previous?: Route) => void): () => void {
  let current = parseRoute(location.href);
  const check = () => { const next = parseRoute(location.href); if (next.path === current.path) return; const old = current; current = next; onRoute(next, old); };
  const push = history.pushState.bind(history); history.pushState = function (...args) { push(...args); queueMicrotask(check); };
  const replace = history.replaceState.bind(history); history.replaceState = function (...args) { replace(...args); queueMicrotask(check); };
  addEventListener('popstate', check);
  const timer = window.setInterval(check, 250);
  onRoute(current);
  return () => { history.pushState = push; history.replaceState = replace; removeEventListener('popstate', check); clearInterval(timer); };
}
