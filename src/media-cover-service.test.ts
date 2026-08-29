import { describe, expect, it } from 'vitest';
import { createMediaCoverService } from './media-cover-service';
import type { FetchLike } from './types';

describe('media cover service', () => {
  it('batches unique AniList IDs and reuses cached covers', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher: FetchLike = async (input, init) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ data: { Page: { media: [
        { id: 98320, coverImage: { medium: 'https://img.example/98320.jpg' } },
        { id: 99500, coverImage: { medium: 'https://img.example/99500.jpg' } },
      ] } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const service = createMediaCoverService(fetcher);

    expect(await service.load([98320, 98320, 99500])).toEqual(new Map([
      [98320, 'https://img.example/98320.jpg'],
      [99500, 'https://img.example/99500.jpg'],
    ]));
    expect(await service.load([98320])).toEqual(new Map([[98320, 'https://img.example/98320.jpg']]));
    expect(requests).toHaveLength(1);
    expect(JSON.parse(String(requests[0].init?.body)).variables).toEqual({ ids: [98320, 99500] });
  });

  it('reports an AniList API failure so the caller can keep placeholders', async () => {
    const fetcher: FetchLike = async () => new Response('', { status: 429 });
    await expect(createMediaCoverService(fetcher).load([98320])).rejects.toThrow('cover data: 429');
  });
});
