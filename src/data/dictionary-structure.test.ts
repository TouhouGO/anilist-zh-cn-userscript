import { describe, expect, it } from 'vitest';
import { uiZhCN } from './ui';
import { bangumiTagZhCN, tagZhCN } from './tags';
import { titleOverrides } from './titles/overrides';

describe('community-maintained dictionary modules', () => {
  it('exports every supported UI section from the domain index', () => {
    expect(Object.keys(uiZhCN)).toEqual([
      'global',
      'home',
      'search',
      'media',
      'list',
      'profile',
      'forum',
      'notifications',
      'settings',
    ]);
    expect(uiZhCN.global.Home).toBe('首页');
    expect(uiZhCN.settings['Title Language']).toBe('标题语言');
  });

  it('keeps the base tag dictionary and community overrides separate', () => {
    expect(tagZhCN['4-koma']).toBe('四格');
    expect(bangumiTagZhCN['4-koma']).toBe('四格漫画');
    expect(bangumiTagZhCN['Cute Girls Doing Cute Things']).toBe('萌系少女日常');
  });

  it('exports title overrides keyed by positive AniList IDs', () => {
    expect(titleOverrides[1]).toBe('星际牛仔');
    expect(Object.keys(titleOverrides).every((id) => Number.isInteger(Number(id)) && Number(id) > 0)).toBe(true);
  });
});
