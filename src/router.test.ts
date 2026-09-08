import { describe, expect, it } from 'vitest';
import { parseRoute } from './router';

describe('parseRoute', () => {
  it('parses media, list and settings routes', () => {
    expect(parseRoute('https://anilist.co/anime/123/title/')).toMatchObject({ section: 'media', type: 'anime', id: 123 });
    expect(parseRoute('https://anilist.co/user/foo/animelist')).toMatchObject({ section: 'list' });
    expect(parseRoute('https://anilist.co/settings/account')).toMatchObject({ section: 'settings' });
  });
});
