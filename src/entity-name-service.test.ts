import { describe, expect, it } from 'vitest';
import { createEntityNameService, entityKey } from './entity-name-service';
import type { EntityKind } from './entity-name-types';
import type { StorageLike } from './types';

function memoryStorage(initial?: string): StorageLike {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('anilist-zh-cn-entity-name-cache-v1', initial);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('Entity name service', () => {
  it('uses overrides, then Wikidata, then Bangumi', async () => {
    const wikidataIds: number[][] = [];
    const bangumiIds: number[][] = [];
    const wikidata = { load: async (_kind: EntityKind, ids: number[]) => {
      wikidataIds.push(ids);
      return new Map(ids.includes(2) ? [[2, '维基角色']] : []);
    } };
    const bangumi = { load: async (_context: unknown, _kind: EntityKind, ids: number[]) => {
      bangumiIds.push(ids);
      return new Map(ids.includes(3) ? [[3, '番组角色']] : []);
    } };
    const service = createEntityNameService({
      storage: memoryStorage(),
      now: () => 1_000,
      overrides: { character: { 1: '人工角色' }, staff: {} },
      wikidata,
      bangumi,
    });

    const result = await service.resolve([
      { kind: 'character', id: 1 },
      { kind: 'character', id: 2 },
      { kind: 'character', id: 3 },
    ], { mediaId: 1, mediaType: 'ANIME' });

    expect(result.get(entityKey({ kind: 'character', id: 1 }))).toMatchObject({ name: '人工角色', source: 'override' });
    expect(result.get('character:2')).toMatchObject({ name: '维基角色', source: 'wikidata' });
    expect(result.get('character:3')).toMatchObject({ name: '番组角色', source: 'bangumi' });
    expect(wikidataIds).toEqual([[2, 3]]);
    expect(bangumiIds).toEqual([[3]]);
  });

  it('keeps a positive result for 30 days before refreshing it', async () => {
    const day = 86_400_000;
    let now = 10_000;
    let calls = 0;
    const service = createEntityNameService({
      storage: memoryStorage(), now: () => now,
      overrides: { character: {}, staff: {} },
      wikidata: { load: async () => { calls++; return new Map([[2, `名称${calls}`]]); } },
      bangumi: { load: async () => new Map() },
    });

    expect((await service.resolve([{ kind: 'character', id: 2 }])).get('character:2')?.name).toBe('名称1');
    now += 29 * day;
    expect((await service.resolve([{ kind: 'character', id: 2 }])).get('character:2')?.name).toBe('名称1');
    now += 2 * day;
    expect((await service.resolve([{ kind: 'character', id: 2 }])).get('character:2')?.name).toBe('名称2');
    expect(calls).toBe(2);
  });

  it('keeps a miss for 7 days before retrying', async () => {
    const day = 86_400_000;
    let now = 20_000;
    let calls = 0;
    const service = createEntityNameService({
      storage: memoryStorage(), now: () => now,
      overrides: { character: {}, staff: {} },
      wikidata: { load: async () => { calls++; return new Map(); } },
      bangumi: { load: async () => new Map() },
    });

    expect(await service.resolve([{ kind: 'staff', id: 9 }])).toEqual(new Map());
    now += 6 * day;
    expect(await service.resolve([{ kind: 'staff', id: 9 }])).toEqual(new Map());
    now += 2 * day;
    expect(await service.resolve([{ kind: 'staff', id: 9 }])).toEqual(new Map());
    expect(calls).toBe(2);
  });

  it('falls through source failures and ignores malformed cache JSON', async () => {
    const service = createEntityNameService({
      storage: memoryStorage('{not-json'), now: () => 30_000,
      overrides: { character: {}, staff: {} },
      wikidata: { load: async () => { throw new Error('wikidata offline'); } },
      bangumi: { load: async () => new Map([[3, '补全角色']]) },
    });

    const result = await service.resolve([{ kind: 'character', id: 3 }], { mediaId: 1, mediaType: 'ANIME' });

    expect(result.get('character:3')).toMatchObject({ name: '补全角色', source: 'bangumi' });
  });

  it('does not turn network failures into a seven-day miss', async () => {
    let calls = 0;
    const service = createEntityNameService({
      storage: memoryStorage(), now: () => 40_000,
      overrides: { character: {}, staff: {} },
      wikidata: { load: async () => { calls++; throw new Error('offline'); } },
      bangumi: { load: async () => { throw new Error('offline'); } },
    });

    await service.resolve([{ kind: 'character', id: 4 }], { mediaId: 1, mediaType: 'ANIME' });
    await service.resolve([{ kind: 'character', id: 4 }], { mediaId: 1, mediaType: 'ANIME' });

    expect(calls).toBe(2);
  });
});
