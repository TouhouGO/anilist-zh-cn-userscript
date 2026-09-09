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
    expect(translateText('12543 users', { section: 'search' })).toBe('12543 名用户');
    expect(translateText('12 episodes', { section: 'search' })).toBe('12 集');
    expect(translateText('45 chapters', { section: 'search' })).toBe('45 话');
    expect(translateText('1 vol', { section: 'search' })).toBe('1 卷');
    expect(translateText('Airing Since 2024', { section: 'search' })).toBe('2024年起播出');
    expect(translateText('Publishing Since 2023', { section: 'search' })).toBe('2023年起连载');
    expect(translateText('Publishing Now', { section: 'search' })).toBe('连载中');
    expect(translateText('Ep 5 airing in', { section: 'search' })).toBe('第 5 集，还剩');
    expect(translateText('2 days, 4 hours', { section: 'search' })).toBe('2 天 4 小时');
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
  it('supports case-adaptive fallback and newly added filter/profile terms', () => {
    expect(translateText('year', { section: 'search' })).toBe('年份');
    expect(translateText('SEASON', { section: 'search' })).toBe('季度');
    expect(translateText('format', { section: 'search' })).toBe('格式');
    expect(translateText('airing status', { section: 'search' })).toBe('放送状态');
    expect(translateText('Country Of Origin', { section: 'search' })).toBe('国家/地区');
    expect(translateText('Streaming On', { section: 'search' })).toBe('流媒体平台');
    expect(translateText('Year Range', { section: 'search' })).toBe('年份范围');
    expect(translateText('Hide My Anime', { section: 'search' })).toBe('隐藏我的动画');
    expect(translateText('Advanced Genre & Tag Filters', { section: 'search' })).toBe('高级类型与标签筛选');
    expect(translateText('Completed Date', { section: 'list' })).toBe('完成日期');
    expect(translateText('Last Updated', { section: 'list' })).toBe('最近更新');
    expect(translateText('Voice Actors', { section: 'profile' })).toBe('声优');
    expect(translateText('Forum Threads', { section: 'profile' })).toBe('论坛主题');
    expect(translateText('Forum Comments', { section: 'profile' })).toBe('论坛回复');
  });
  it('translates dynamic ranking badges, English dates, relations, and progress tracking buttons', () => {
    expect(translateText('#93 Highest Rated 2009', { section: 'media' })).toBe('#93 2009年 评分最高');
    expect(translateText('#32 Most Popular 2009', { section: 'media' })).toBe('#32 2009年 最高人气');
    expect(translateText('#1 Highest Rated All Time', { section: 'media' })).toBe('#1 历史评分最高');
    expect(translateText('Jan 4, 2009', { section: 'media' })).toBe('2009年1月4日');
    expect(translateText('Mar 29, 2009', { section: 'media' })).toBe('2009年3月29日');
    expect(translateText('TV · Finished', { section: 'media' })).toBe('电视动画 · 已完结');
    expect(translateText('Manga · Finished', { section: 'media' })).toBe('漫画 · 已完结');
    expect(translateText('Sequel', { section: 'media' })).toBe('续作');
    expect(translateText('Alternative', { section: 'media' })).toBe('衍生版本');
    expect(translateText('Set as Complete', { section: 'media' })).toBe('标为已完成');
    expect(translateText('Open List Editor', { section: 'media' })).toBe('打开列表编辑器');
    expect(translateText('Watched episode 2 - 3 of', { section: 'profile' })).toBe('看完第 2 - 3 集，共');
    expect(translateText('Plans to watch', { section: 'profile' })).toBe('计划观看');
  });
});
