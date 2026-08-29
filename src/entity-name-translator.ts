import type { EntityMediaContext } from './bangumi-entity-source';
import { entityKey, type EntityNameService } from './entity-name-service';
import type { EntityRef } from './entity-name-types';

type Scheduler = (callback: () => void) => void;
type Candidate = { target: HTMLElement; ref: EntityRef; link?: HTMLAnchorElement };

const entityLinkSelector = 'a[href*="/character/"], a[href*="/staff/"]';
const nameSelector = '.name, .title, [class*="name"]';

export function extractEntityRef(path: string): EntityRef | undefined {
  const match = path.match(/^\/(character|staff)\/(\d+)(?:\/|$)/);
  if (!match) return undefined;
  const id = Number(match[2]);
  return Number.isInteger(id) && id > 0 ? { kind: match[1] as EntityRef['kind'], id } : undefined;
}

function sameRef(left: EntityRef | undefined, right: EntityRef): boolean {
  return Boolean(left && left.kind === right.kind && left.id === right.id);
}

function prepareTarget(target: HTMLElement, ref: EntityRef): boolean {
  const key = entityKey(ref);
  const previousKey = target.dataset.anilistZhCnEntityKey;
  if (previousKey && previousKey !== key) {
    const oldTranslation = target.dataset.anilistZhCnEntityTranslated;
    if (oldTranslation && target.textContent?.trim() === oldTranslation && target.dataset.anilistZhCnEntityOriginal) {
      target.textContent = target.dataset.anilistZhCnEntityOriginal;
    }
    delete target.dataset.anilistZhCnEntityKey;
    delete target.dataset.anilistZhCnEntityOriginal;
    delete target.dataset.anilistZhCnEntityTranslated;
  }
  const original = target.textContent?.trim();
  if (!original) return false;
  if (!target.dataset.anilistZhCnEntityKey) {
    target.dataset.anilistZhCnEntityKey = key;
    target.dataset.anilistZhCnEntityOriginal = original;
  }
  return true;
}

export function applyEntityName(target: HTMLElement, ref: EntityRef, name: string): boolean {
  if (!prepareTarget(target, ref)) return false;
  const normalized = name.trim();
  if (!normalized || target.textContent?.trim() === normalized) return false;
  target.textContent = normalized;
  target.dataset.anilistZhCnEntityTranslated = normalized;
  return true;
}

function findNameTarget(link: HTMLAnchorElement): HTMLElement | undefined {
  const nested = link.querySelector<HTMLElement>(nameSelector);
  if (nested?.textContent?.trim()) return nested;
  if (link.children.length === 0 && link.textContent?.trim()) return link;
  return undefined;
}

function linksWithin(root: Element): HTMLAnchorElement[] {
  const links: HTMLAnchorElement[] = [];
  if (root.matches(entityLinkSelector)) links.push(root as HTMLAnchorElement);
  links.push(...Array.from(root.querySelectorAll<HTMLAnchorElement>(entityLinkSelector)));
  return [...new Set(links)];
}

function headingsWithin(root: Element): HTMLElement[] {
  const headings: HTMLElement[] = [];
  if (root.matches('h1')) headings.push(root as HTMLElement);
  headings.push(...Array.from(root.querySelectorAll<HTMLElement>('h1')));
  return [...new Set(headings)];
}

export function createEntityNameTranslator(
  service: Pick<EntityNameService, 'resolve'>,
  scheduler: Scheduler = queueMicrotask,
) {
  let generation = 0;
  let scheduled = false;
  let currentContext: EntityMediaContext | undefined;
  const pending = new Map<string, Candidate[]>();

  const queueCandidate = (candidate: Candidate) => {
    if (!prepareTarget(candidate.target, candidate.ref)) return;
    const key = entityKey(candidate.ref);
    const candidates = pending.get(key) || [];
    if (!candidates.some(item => item.target === candidate.target)) candidates.push(candidate);
    pending.set(key, candidates);
    if (!scheduled) {
      scheduled = true;
      scheduler(() => { void flush(); });
    }
  };

  const translate = (root: Element, context?: EntityMediaContext, path = typeof location === 'undefined' ? '/' : location.pathname) => {
    currentContext = context;
    for (const link of linksWithin(root)) {
      const ref = extractEntityRef(new URL(link.href, 'https://anilist.co').pathname);
      const target = ref ? findNameTarget(link) : undefined;
      if (ref && target) queueCandidate({ target, ref, link });
    }
    const pageRef = extractEntityRef(path);
    if (pageRef) for (const heading of headingsWithin(root)) queueCandidate({ target: heading, ref: pageRef });
  };

  async function flush(): Promise<number> {
    scheduled = false;
    if (!pending.size) return 0;
    const requestGeneration = generation;
    const batch = new Map(pending);
    pending.clear();
    const refs = [...batch.values()].map(candidates => candidates[0].ref);
    let names: Awaited<ReturnType<EntityNameService['resolve']>>;
    try { names = await service.resolve(refs, currentContext); }
    catch { return 0; }
    if (requestGeneration !== generation) return 0;

    let count = 0;
    for (const [key, candidates] of batch) {
      const resolved = names.get(key);
      if (!resolved) continue;
      for (const candidate of candidates) {
        if (candidate.target.isConnected === false) continue;
        if (candidate.target.dataset.anilistZhCnEntityKey !== key) continue;
        if (candidate.link) {
          const currentRef = extractEntityRef(new URL(candidate.link.href, 'https://anilist.co').pathname);
          if (!sameRef(currentRef, candidate.ref)) continue;
        }
        if (applyEntityName(candidate.target, candidate.ref, resolved.name)) count++;
      }
    }
    return count;
  }

  return {
    translate,
    flush,
    beginRoute() {
      generation++;
      currentContext = undefined;
      pending.clear();
      scheduled = false;
    },
  };
}
