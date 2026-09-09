import { describe, expect, it } from 'vitest';
import {
  createEntityBundleService,
  normalizeEntityName,
  BUNDLE_STORAGE_KEY,
  BUNDLE_URL_PRIMARY,
  BUNDLE_URL_FALLBACK,
} from './entity-bundle-service';
import type { StorageLike } from './types';

function createMockStorage(initial?: string): StorageLike {
  const map = new Map<string, string>();
  if (initial) map.set(BUNDLE_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => map.get(key) || null,
    setItem: (key: string, val: string) => { map.set(key, val); },
  };
}

describe('EntityBundleService', () => {
  it('normalizes names by removing punctuation and lowercasing', () => {
    expect(normalizeEntityName('Daisuke Ono')).toBe('daisukeono');
    expect(normalizeEntityName('Satoru Gojō')).toBe('satorugoj');
    expect(normalizeEntityName('Aika S. Granzchesta')).toBe('aikasgranzchesta');
  });

  it('looks up entities by ID and normalized name from initial bundle', () => {
    const service = createEntityBundleService(createMockStorage(), async () => ({}), {
      char_8087: '乔尼·乔斯达',
      person_95212: '小野大辅',
      name_daisukeono: '小野大辅',
      name_onodaisuke: '小野大辅',
    });

    expect(service.isLoaded()).toBe(true);
    expect(service.getById('character', 8087)).toBe('乔尼·乔斯达');
    expect(service.getById('staff', 95212)).toBe('小野大辅');
    expect(service.getByName('Daisuke Ono')).toBe('小野大辅');
    expect(service.getByName('Ono Daisuke')).toBe('小野大辅');
    expect(service.getById('character', 999999)).toBeUndefined();
  });

  it('loads bundle from primary URL and writes to storage', async () => {
    const storage = createMockStorage();
    const requestedUrls: string[] = [];
    const requester = async (url: string) => {
      requestedUrls.push(url);
      return {
        char_378: '水无灯里',
        person_95585: '叶月绘理乃',
      };
    };

    const service = createEntityBundleService(storage, requester);
    expect(service.isLoaded()).toBe(false);

    const loaded = await service.load();
    expect(loaded).toBe(true);
    expect(service.isLoaded()).toBe(true);
    expect(requestedUrls).toEqual([BUNDLE_URL_PRIMARY]);
    expect(service.getById('character', 378)).toBe('水无灯里');
    expect(storage.getItem(BUNDLE_STORAGE_KEY)).toContain('水无灯里');
  });

  it('falls back to fallback CDN URL when primary URL fails', async () => {
    const requestedUrls: string[] = [];
    const requester = async (url: string) => {
      requestedUrls.push(url);
      if (url === BUNDLE_URL_PRIMARY) throw new Error('Network error');
      return { char_100: '测试角色' };
    };

    const service = createEntityBundleService(createMockStorage(), requester);
    const loaded = await service.load();

    expect(loaded).toBe(true);
    expect(requestedUrls).toEqual([BUNDLE_URL_PRIMARY, BUNDLE_URL_FALLBACK]);
    expect(service.getById('character', 100)).toBe('测试角色');
  });
});
