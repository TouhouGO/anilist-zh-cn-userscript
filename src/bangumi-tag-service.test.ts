import { describe, expect, it } from 'vitest';
import { createBangumiTagService } from './bangumi-tag-service';

describe('Bangumi tag service', () => {
  it('maps only Bangumi tags that have a curated AniList counterpart', async () => {
    const service = createBangumiTagService(async (url) => ({ ok: url.endsWith('/253'), json: async () => ({ tags: [{ name: '妖怪' }, { name: '本地标签' }] }) }));
    await expect(service.loadForAniList(1)).resolves.toEqual({ Youkai: '妖怪' });
  });
});
