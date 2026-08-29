export function startDomObserver(onNodes: (nodes: Element[]) => void): () => void {
  let queued = false; const pending = new Set<Element>();
  const flush = () => { queued = false; const nodes = [...pending]; pending.clear(); if (nodes.length) onNodes(nodes); };
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') for (const node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) pending.add(node as Element);
      if (mutation.type === 'characterData' || mutation.type === 'attributes') if (mutation.target.parentElement) pending.add(mutation.target.parentElement);
    }
    if (!queued) { queued = true; queueMicrotask(flush); }
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  return () => observer.disconnect();
}

type HoverRoot = Pick<Document, 'addEventListener' | 'removeEventListener'>;
type Schedule = (callback: () => void, delay: number) => unknown;
export function startMediaHoverObserver(onHover: (path: string) => void, root: HoverRoot = document, schedule: Schedule = setTimeout): () => void {
  let generation = 0;
  const handler = (event: Event) => {
    const target = event.target as { closest?: (selector: string) => { getAttribute?: (name: string) => string | null } | null } | null;
    const link = target?.closest?.('a.favourite.media[href^="/anime/"], a.favourite.media[href^="/manga/"]');
    const path = link?.getAttribute?.('href'); if (!path) return;
    const current = ++generation;
    for (const delay of [0, 80, 240]) schedule(() => { if (current === generation) onHover(path); }, delay);
  };
  root.addEventListener('mouseover', handler as EventListener, true);
  return () => root.removeEventListener('mouseover', handler as EventListener, true);
}
