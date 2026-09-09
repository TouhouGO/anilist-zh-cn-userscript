import { createBangumiEntitySource, type BangumiEntitySource, type EntityMediaContext } from './bangumi-entity-source';
import { toMainlandChinese } from './chinese-normalizer';
import { entityNameOverrides } from './data/entities/overrides';
import { createEntityBundleService, type EntityBundleService } from './entity-bundle-service';
import type { EntityKind, EntityNameSource, EntityRef } from './entity-name-types';
import { getSafeStorage, type StorageLike } from './types';
import { createWikidataNameSource } from './wikidata-name-source';

export type EntityNameOrigin = 'override' | 'bundle' | 'wikidata' | 'bangumi' | 'cjk';
export type ResolvedEntityName = {
  kind: EntityKind;
  id: number;
  name: string;
  source: EntityNameOrigin;
};

type CacheEntry = {
  name: string | null;
  source: EntityNameOrigin | 'miss';
  expiresAt: number;
};
type CachePayload = { version: 1; entries: Record<string, CacheEntry> };
type OverrideMap = Record<EntityKind, Record<number, string>>;
type EntityNameServiceOptions = {
  storage?: StorageLike;
  now?: () => number;
  overrides?: OverrideMap;
  bundle?: EntityBundleService;
  wikidata?: EntityNameSource;
  bangumi?: BangumiEntitySource;
};

export type EntityNameService = {
  resolve(refs: EntityRef[], context?: EntityMediaContext): Promise<Map<string, ResolvedEntityName>>;
  loadBundle(): Promise<boolean>;
};

const CACHE_KEY = 'anilist-zh-cn-entity-name-cache-v2';
const DAY = 86_400_000;
const POSITIVE_TTL = 30 * DAY;
const NEGATIVE_TTL = 7 * DAY;

export function entityKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function readCache(storage: StorageLike): Record<string, CacheEntry> {
  try {
    const rawV2 = storage.getItem(CACHE_KEY);
    if (rawV2) {
      const payload = JSON.parse(rawV2) as CachePayload | null;
      if (payload?.version === 1 && payload.entries && typeof payload.entries === 'object') return payload.entries;
    }
    const rawV1 = storage.getItem('anilist-zh-cn-entity-name-cache-v1');
    if (rawV1) {
      const payload = JSON.parse(rawV1) as CachePayload | null;
      if (payload?.entries && typeof payload.entries === 'object') {
        const migrated: Record<string, CacheEntry> = {};
        for (const [k, v] of Object.entries(payload.entries)) {
          if (v && v.name && v.source !== 'miss') migrated[k] = v;
        }
        return migrated;
      }
    }
  } catch {
    /* ignore malformed local cache */
  }
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
  const storage = getSafeStorage(options.storage);
  const now = options.now || Date.now;
  const overrides = options.overrides || entityNameOverrides;
  const bundle = options.bundle || createEntityBundleService(storage);
  const wikidata = options.wikidata || createWikidataNameSource();
  const bangumi = options.bangumi || createBangumiEntitySource();
  const cache = readCache(storage);

  if (!bundle.isLoaded()) {
    void bundle.load();
  }

  const saveCache = () => storage.setItem(CACHE_KEY, JSON.stringify({ version: 1, entries: cache } satisfies CachePayload));
  const storePositive = (ref: EntityRef, name: string, source: EntityNameOrigin) => {
    cache[entityKey(ref)] = { name, source, expiresAt: now() + POSITIVE_TTL };
  };

  const actorResolver = (staffId: number): string | undefined => {
    return overrides.staff[staffId] || bundle.getById('staff', staffId);
  };

  return {
    async loadBundle() {
      return bundle.load();
    },

    async resolve(refs, context) {
      const unique = new Map<string, EntityRef>();
      for (const ref of refs) {
        if ((ref.kind === 'character' || ref.kind === 'staff') && Number.isInteger(ref.id) && ref.id > 0) {
          const key = entityKey(ref);
          const existing = unique.get(key);
          if (!existing) {
            unique.set(key, ref);
          } else {
            // merge additional context if newly provided
            if (!existing.currentName && ref.currentName) existing.currentName = ref.currentName;
            if (!existing.actorStaffId && ref.actorStaffId) existing.actorStaffId = ref.actorStaffId;
            if (!existing.actorName && ref.actorName) existing.actorName = ref.actorName;
          }
        }
      }

      const result = new Map<string, ResolvedEntityName>();
      const pending = new Map<string, EntityRef>();
      let cacheChanged = false;

      for (const [key, ref] of unique) {
        // 1. Check overrides
        const override = validName(overrides[ref.kind][ref.id]);
        if (override) {
          result.set(key, { ...ref, name: override, source: 'override' });
          continue;
        }

        // 2. Check bundle by ID
        const bundleById = validName(bundle.getById(ref.kind, ref.id));
        if (bundleById) {
          result.set(key, { ...ref, name: bundleById, source: 'bundle' });
          storePositive(ref, bundleById, 'bundle');
          cacheChanged = true;
          continue;
        }

        // 3. Check bundle by Name
        if (ref.currentName) {
          const bundleByName = validName(bundle.getByName(ref.currentName));
          if (bundleByName) {
            result.set(key, { ...ref, name: bundleByName, source: 'bundle' });
            storePositive(ref, bundleByName, 'bundle');
            cacheChanged = true;
            continue;
          }
        }

        // 4. Check persistent local cache
        const cached = cache[key];
        if (cached && cached.expiresAt > now()) {
          if (cached.name && cached.source !== 'miss') {
            result.set(key, { ...ref, name: cached.name, source: cached.source });
            continue;
          }
          if (cached.source === 'miss') {
            continue;
          }
        }
        if (cached) {
          delete cache[key];
          cacheChanged = true;
        }
        pending.set(key, ref);
      }

      const failed = new Set<string>();

      // 5. Query Wikidata Name Source
      if (pending.size > 0) {
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
      }

      // 6. Query Bangumi if context exists (Anime/Manga details page)
      if (context && pending.size > 0) {
        for (const [kind, group] of Object.entries(groupPending(pending)) as Array<[EntityKind, EntityRef[]]>) {
          if (!group.length) continue;
          try {
            const ids = group.map(ref => ref.id);
            const names = await bangumi.load(context, kind, ids, group, actorResolver);
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

      // 7. CJK Fallback (Native Japanese Kanji to Simplified Chinese)
      for (const [key, ref] of pending) {
        if (ref.currentName && /[\p{Script=Han}]/u.test(ref.currentName)) {
          const simplified = validName(ref.currentName);
          if (simplified) {
            result.set(key, { ...ref, name: simplified, source: 'cjk' });
            storePositive(ref, simplified, 'cjk');
            pending.delete(key);
            cacheChanged = true;
          }
        }
      }

      // 8. Negative cache remaining misses
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
