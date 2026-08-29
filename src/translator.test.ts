import { describe, expect, it } from 'vitest';
import { translateText } from './translator';

describe('translateText', () => {
  it('translates exact UI text and preserves protected content', () => {
    expect(translateText('Home', { section: 'global' })).toBe('首页');
    expect(translateText('Anime', { section: 'search' })).toBe('动画');
    expect(translateText('Unknown user text', { section: 'global' })).toBe('Unknown user text');
  });
  it('translates home activity templates and relative times', () => {
    expect(translateText('Watched episode 2 - 11 of', { section: 'home' })).toBe('看完第 2 - 11 集，共');
    expect(translateText('Please read the site guidelines before posting', { section: 'home' })).toBe('发布前请阅读站点指南');
    expect(translateText('1 hour ago', { section: 'home' })).toBe('1 小时前');
  });
  it('translates home discovery and review section labels', () => {
    expect(translateText('Recent Reviews', { section: 'home' })).toBe('最新评论');
    expect(translateText('Review of', { section: 'home' })).toBe('评论：');
    expect(translateText('Read Full Review', { section: 'home' })).toBe('查看完整评论');
    expect(translateText('Trending Anime & Manga', { section: 'home' })).toBe('热门动画与漫画');
    expect(translateText('Newly Added Anime', { section: 'home' })).toBe('最新添加的动画');
    expect(translateText('Newly Added Manga', { section: 'home' })).toBe('最新添加的漫画');
    expect(translateText('View All', { section: 'home' })).toBe('查看全部');
    expect(translateText('Progress: 9/14', { section: 'home' })).toBe('进度：9/14');
    expect(translateText('7 episodes behind', { section: 'home' })).toBe('落后 7 集');
    expect(translateText('3d 13h 18m', { section: 'home' })).toBe('3天 13小时 18分钟');
  });
  it('translates search result metadata and airing phrases', () => {
    expect(translateText('Ep 10 airing in 6 days', { section: 'search' })).toBe('第 10 集，将于 6 天后播出');
    expect(translateText('TV Show • 26 episodes', { section: 'search' })).toBe('电视动画 · 26 集');
    expect(translateText('Fall 2026', { section: 'search' })).toBe('2026年秋季');
  });
  it('translates media detail metadata and tag labels', () => {
    expect(translateText('Episode Duration', { section: 'media' })).toBe('单集时长');
    expect(translateText('External & Streaming links', { section: 'media' })).toBe('外部与流媒体链接');
    expect(translateText('Youkai', { section: 'media' })).toBe('妖怪');
    expect(translateText('23 mins', { section: 'media' })).toBe('23 分钟');
    expect(translateText('598 Users', { section: 'media' })).toBe('598 名用户');
  });
  it('uses natural Mainland Chinese terminology for AniList tags', () => {
    const cases: Array<[string, string]> = [
      ['Crossdressing', '异性装扮'],
      ['Dissociative Identities', '多重人格'],
      ['Female Harem', '后宫'],
      ['Male Harem', '逆后宫'],
      ['Kuudere', '冷娇'],
      ['Monster Girl', '魔物娘'],
      ['Post-Apocalyptic', '末世'],
      ['Slapstick', '肢体喜剧'],
      ['Long Strip', '条漫'],
      ['Ancient China', '中国古代'],
      ['Reverse Isekai', '反向异世界'],
      ['Time Loop', '时间循环'],
      ['Vocal Synth', '歌声合成'],
    ];
    for (const [tag, expected] of cases) {
      expect(translateText(tag, { section: 'media' })).toBe(expected);
      expect(translateText(tag, { section: 'list' })).toBe(expected);
    }
  });
}); 
