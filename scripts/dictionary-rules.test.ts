import { describe, expect, it } from 'vitest';
import { findDuplicateObjectKeys, validateDictionaryData } from './dictionary-rules';
import type { DictionaryData } from './dictionary-rules';

const validData = (): DictionaryData => ({
  ui: {
    global: { Home: '首页' },
    home: { Activity: '动态' },
    search: { Search: '搜索' },
    media: { Overview: '概览' },
    list: { Watching: '观看中' },
    profile: { Stats: '统计' },
    forum: { Reply: '回复' },
    notifications: { Unread: '未读' },
    settings: { Language: '语言' },
  },
  baseTags: { '4-koma': '四格' },
  communityTags: { '4-koma': '四格漫画' },
  titleOverrides: { 1: '星际牛仔' },
});

describe('dictionary quality rules', () => {
  it('accepts a complete and meaningful dictionary fixture', () => {
    expect(validateDictionaryData(validData())).toEqual([]);
  });

  it('reports empty keys and translations', () => {
    const data = validData();
    data.ui.global = { '': '首页', Home: ' ' };
    data.baseTags = { '': '四格', '4-koma': '' };

    expect(validateDictionaryData(data)).toEqual(expect.arrayContaining([
      'UI/global：存在空键',
      'UI/global/Home：译文为空',
      '标签基础词典：存在空键',
      '标签基础词典/4-koma：译文为空',
    ]));
  });

  it('reports missing UI sections and invalid title IDs', () => {
    const data = validData();
    delete data.ui.forum;
    data.titleOverrides = { 0: '错误条目', 1: '' };

    expect(validateDictionaryData(data)).toEqual(expect.arrayContaining([
      'UI：缺少页面域 forum',
      '标题修正/0：AniList ID 必须是正整数',
      '标题修正/1：译文为空',
    ]));
  });

  it('reports community overrides that do not change the base translation', () => {
    const data = validData();
    data.communityTags['4-koma'] = '四格';

    expect(validateDictionaryData(data)).toContain('标签社区修正/4-koma：与基础译名相同，请删除重复项');
  });

  it('finds duplicate keys inside the same object literal', () => {
    const source = `export const dictionary = {
      Home: '首页',
      Search: '搜索',
      Home: '主页',
      nested: { Save: '保存', Save: '储存' },
    };`;

    expect(findDuplicateObjectKeys(source, 'fixture.ts')).toEqual([
      'fixture.ts：对象中存在重复键 Home',
      'fixture.ts：对象中存在重复键 Save',
    ]);
  });
});
