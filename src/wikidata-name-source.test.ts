import { describe, expect, it } from 'vitest';
import { createWikidataNameSource } from './wikidata-name-source';

describe('Wikidata entity names', () => {
  it('queries direct AniList character IDs and keeps only Han labels', async () => {
    const urls: string[] = [];
    const request = async (url: string) => {
      urls.push(url);
      return { results: { bindings: [
        { anilistId: { type: 'literal', value: '1' }, itemLabel: { type: 'literal', value: '史派克·斯皮格尔' } },
        { anilistId: { type: 'literal', value: '2' }, itemLabel: { type: 'literal', value: 'Faye Valentine' } },
      ] } };
    };

    const result = await createWikidataNameSource(request).load('character', [1, 2]);

    expect(new URL(urls[0]).searchParams.get('query')).toContain('wdt:P11736');
    expect(result).toEqual(new Map([[1, '史派克·斯皮格尔']]));
  });

  it('uses the AniList staff property and ignores unrequested IDs', async () => {
    const urls: string[] = [];
    const request = async (url: string) => {
      urls.push(url);
      return { results: { bindings: [
        { anilistId: { type: 'literal', value: '95011' }, itemLabel: { type: 'literal', value: '山寺宏一' } },
        { anilistId: { type: 'literal', value: '99999' }, itemLabel: { type: 'literal', value: '其他人物' } },
      ] } };
    };

    const result = await createWikidataNameSource(request).load('staff', [95011]);

    expect(new URL(urls[0]).searchParams.get('query')).toContain('wdt:P11227');
    expect(result).toEqual(new Map([[95011, '山寺宏一']]));
  });

  it('skips requests for an empty or invalid ID set', async () => {
    let calls = 0;
    const result = await createWikidataNameSource(async () => { calls++; return {}; })
      .load('character', [Number.NaN, 1.5]);

    expect(result).toEqual(new Map());
    expect(calls).toBe(0);
  });

  it('splits more than 30 IDs into bounded requests', async () => {
    const requestedQueries: string[] = [];
    const source = createWikidataNameSource(async (url) => {
      requestedQueries.push(new URL(url).searchParams.get('query') || '');
      return { results: { bindings: [] } };
    });

    await source.load('character', Array.from({ length: 31 }, (_, index) => index + 1));

    expect(requestedQueries).toHaveLength(2);
    expect(requestedQueries[0]).toContain('"30"');
    expect(requestedQueries[0]).not.toContain('"31"');
    expect(requestedQueries[1]).toContain('"31"');
  });
});
