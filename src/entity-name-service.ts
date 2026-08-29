import { createBangumiEntitySource, type BangumiEntitySource, type EntityMediaContext } from './bangumi-entity-source';
import { toMainlandChinese } from './chinese-normalizer';
import { entityNameOverrides } from './data/entities/overrides';
import type { EntityKind, EntityNameSource, EntityRef } from './entity-name-types';
import type { StorageLike } from './types';
import { createWikidataNameSource } from './wikidata-name-source';

export type EntityNameOrigin = 'override' | 'wikidata' | 'bangumi';
export type ResolvedEntityName = {
  kind: EntityKind;
  id: number;
  name: string;
  source: EntityNameOrigin;
};

type CacheEntry = {
  name: string | null;
  source: 'wikidata' | 'bangumi' | 'miss';
  expiresAt: number;
};
type CachePayload = { version: 1; entries: Record<string, CacheEntry> };
type OverrideMap = Record<EntityKind, Record<number, string>>;
type EntityNameServiceOptions = {
  storage?: StorageLike;
  now?: () => number;
  overrides?: OverrideMap;
  wikidata?: EntityNameSource;
  bangumi?: BangumiEntitySource;
};

export type EntityNameService = {
  resolve(refs: EntityRef[], context?: EntityMediaContext): Promise<Map<string, ResolvedEntityName>>;
};

const CACHE_KEY = 'anilist-zh-cn-entity-name-cache-v1';
const DAY = 86_400_000;
const POSITIVE_TTL = 30 * DAY;
const NEGATIVE_TTL = 7 * DAY;

export function entityKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function readCache(storage: StorageLike): Record<string, CacheEntry> {
  try {
    const payload = JSON.parse(storage.getItem(CACHE_KEY) || 'null') as CachePayload | null;
    if (payload?.version === 1 && payload.entries && typeof payload.entries === 'object') return payload.entries;
  } catch { /* ignore malformed local cache */ }
  return {};
}

function validName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const name = toMainlandChinese(value.trim());
  return /[\p{Script=Han}]/u.test(name) ? name : undefined;
}

function groupPending(pending: Map<string, EntityRef>): Record<EntityKind, EntityRef[]> {
  const groups: Record<EntityKind, EntityRef[]> = { character: [], staff: [] };
  for (const ref of pending.values()) groups[ref.kind].push(ref);
  return groups;
}

export function createEntityNameService(options: EntityNameServiceOptions = {}): EntityNameService {
  const storage = options.storage || localStorage;
  const now = options.now || Date.now;
  const overrides = options.overrides || entityNameOverrides;
  const wikidata = options.wikidata || createWikidataNameSource();
  const bangumi = options.bangumi || createBangumiEntitySource();
  const cache = readCache(storage);

  const saveCache = () => storage.setItem(CACHE_KEY, JSON.stringify({ version: 1, entries: cache } satisfies CachePayload));
  const storePositive = (ref: EntityRef, name: string, source: 'wikidata' | 'bangumi') => {
    cache[entityKey(ref)] = { name, source, expiresAt: now() + POSITIVE_TTL };
  };

  return {
    async resolve(refs, context) {
      const unique = new Map<string, EntityRef>();
      for (const ref of refs) if ((ref.kind === 'character' || ref.kind === 'staff') && Number.isInteger(ref.id) && ref.id > 0) unique.set(entityKey(ref), ref);

      const result = new Map<string, ResolvedEntityName>();
      const pending = new Map<string, EntityRef>();
      let cacheChanged = false;
      for (const [key, ref] of unique) {
        const override = validName(overrides[ref.kind][ref.id]);
        if (override) {
          result.set(key, { ...ref, name: override, source: 'override' });
          continue;
        }
        const cached = cache[key];
        if (cached && cached.expiresAt > now()) {
          if (cached.name && cached.source !== 'miss') result.set(key, { ...ref, name: cached.name, source: cached.source });
          continue;
        }
        if (cached) { delete cache[key]; cacheChanged = true; }
        pending.set(key, ref);
      }

      const failed = new Set<string>();
      for (const [kind, group] of Object.entries(groupPending(pending)) as Array<[EntityKind, EntityRef[]]>) {
        if (!group.length) continue;
        try {
          const names = await wikidata.load(kind, group.map(ref => ref.id));
          for (const ref of group) {
            const name = validName(names.get(ref.id));
            if (!name) continue;
            const key = entityKey(ref);
            result.set(key, { ...ref, name, source: 'wikidata' });
            storePositive(ref, name, 'wikidata');
            pending.delete(key);
            cacheChanged = true;
          }
        } catch {
          for (const ref of group) failed.add(entityKey(ref));
        }
      }

      if (context) {
        for (const [kind, group] of Object.entries(groupPending(pending)) as Array<[EntityKind, EntityRef[]]>) {
          if (!group.length) continue;
          try {
            const names = await bangumi.load(context, kind, group.map(ref => ref.id));
            for (const ref of group) {
              const name = validName(names.get(ref.id));
              if (!name) continue;
              const key = entityKey(ref);
              result.set(key, { ...ref, name, source: 'bangumi' });
              storePositive(ref, name, 'bangumi');
              pending.delete(key);
              cacheChanged = true;
            }
          } catch {
            for (const ref of group) failed.add(entityKey(ref));
          }
        }
      }

      for (const [key] of pending) {
        if (failed.has(key)) continue;
        cache[key] = { name: null, source: 'miss', expiresAt: now() + NEGATIVE_TTL };
        cacheChanged = true;
      }
      if (cacheChanged) saveCache();
      return result;
    },
  };
}
