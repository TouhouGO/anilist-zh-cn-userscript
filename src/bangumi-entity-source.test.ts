import { describe, expect, it } from 'vitest';
import { createBangumiEntitySource } from './bangumi-entity-source';
import type { JsonRequestInit } from './json-request';

describe('Bangumi entity fallback', () => {
  it('maps a character only through a unique native-name match', async () => {
    const request = async (url: string) => {
      if (url === 'https://graphql.anilist.co') return { data: { Page: { characters: [{ id: 1, name: { native: 'スパイク・スピーゲル' } }] } } };
      if (url.endsWith('/subjects/253/characters')) return [{ id: 77, name: 'スパイク・スピーゲル', actors: [] }];
      if (url.endsWith('/characters/77')) return { infobox: [{ key: '简体中文名', value: '史派克·斯皮格尔' }] };
      throw new Error(url);
    };

    const source = createBangumiEntitySource(request);
    const result = await source.load({ mediaId: 1, mediaType: 'ANIME' }, 'character', [1]);

    expect(result).toEqual(new Map([[1, '史派克·斯皮格尔']]));
  });

  it('rejects duplicate native-name candidates before requesting details', async () => {
    let detailRequests = 0;
    const request = async (url: string) => {
      if (url === 'https://graphql.anilist.co') return { data: { Page: { characters: [{ id: 1, name: { native: '同名' } }] } } };
      if (url.endsWith('/subjects/253/characters')) return [{ id: 7, name: '同名', actors: [] }, { id: 8, name: '同名', actors: [] }];
      detailRequests++;
      return {};
    };

    const result = await createBangumiEntitySource(request).load({ mediaId: 1, mediaType: 'ANIME' }, 'character', [1]);

    expect(result).toEqual(new Map());
    expect(detailRequests).toBe(0);
  });

  it('finds voice actors through subject character credits', async () => {
    const request = async (url: string) => {
      if (url === 'https://graphql.anilist.co') return { data: { Page: { staff: [{ id: 95011, name: { native: '山寺宏一' } }] } } };
      if (url.endsWith('/subjects/253/persons')) return [];
      if (url.endsWith('/subjects/253/characters')) return [{ id: 77, name: 'スパイク', actors: [{ id: 3914, name: '山寺宏一' }] }];
      if (url.endsWith('/persons/3914')) return { infobox: [{ key: '简体中文名', value: '山寺宏一' }] };
      throw new Error(url);
    };

    const result = await createBangumiEntitySource(request).load({ mediaId: 1, mediaType: 'ANIME' }, 'staff', [95011]);

    expect(result).toEqual(new Map([[95011, '山寺宏一']]));
  });

  it('limits detail requests to two and preserves successful siblings', async () => {
    let active = 0;
    let maxActive = 0;
    const request = async (url: string, init?: JsonRequestInit) => {
      if (url === 'https://graphql.anilist.co') {
        const body = JSON.parse(init?.body || '{}') as { variables?: { ids?: number[] } };
        return { data: { Page: { characters: (body.variables?.ids || []).map(id => ({ id, name: { native: `角色${id}` } })) } } };
      }
      if (url.endsWith('/subjects/253/characters')) return [1, 2, 3, 4].map(id => ({ id: 100 + id, name: `角色${id}`, actors: [] }));
      const match = url.match(/\/characters\/(\d+)$/);
      if (match) {
        const bangumiId = Number(match[1]);
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
        if (bangumiId === 103) throw new Error('one detail failed');
        return { infobox: [{ key: '简体中文名', value: `中文${bangumiId - 100}` }] };
      }
      throw new Error(url);
    };

    const result = await createBangumiEntitySource(request).load({ mediaId: 1, mediaType: 'ANIME' }, 'character', [1, 2, 3, 4]);

    expect(maxActive).toBe(2);
    expect(result).toEqual(new Map([[1, '中文1'], [2, '中文2'], [4, '中文4']]));
  });

  it('does not query Bangumi when the media has no direct subject mapping', async () => {
    let calls = 0;
    const result = await createBangumiEntitySource(async () => { calls++; return {}; })
      .load({ mediaId: 999_999_999, mediaType: 'ANIME' }, 'character', [1]);

    expect(result).toEqual(new Map());
    expect(calls).toBe(0);
  });
});
