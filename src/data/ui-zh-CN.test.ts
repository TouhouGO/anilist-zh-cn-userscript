import { describe, expect, it } from 'vitest';
import { uiZhCN } from './ui-zh-CN';
import { translateText } from '../translator';

describe('UI dictionary', () => {
  it('contains global navigation and common controls', () => {
    expect(uiZhCN.global.Home).toBe('首页');
    expect(uiZhCN.global.Settings).toBe('设置');
    expect(uiZhCN.global['Load More']).toBe('加载更多');
  });
  it('contains profile page navigation and statistics labels', () => {
    expect(uiZhCN.profile['Anime List']).toBe('动画列表');
    expect(uiZhCN.profile['Manga List']).toBe('漫画列表');
    expect(uiZhCN.profile['Total Anime']).toBe('动画总数');
    expect(uiZhCN.profile['Days Watched']).toBe('观看天数');
    expect(uiZhCN.profile['Mean Score']).toBe('平均分');
    expect(uiZhCN.profile.Follow).toBe('关注');
    expect(uiZhCN.profile['Days Planned']).toBe('计划天数');
    expect(uiZhCN.profile['Standard Deviation']).toBe('标准差');
    expect(uiZhCN.profile['Titles Watched']).toBe('观看作品数');
    expect(uiZhCN.profile['Hours Watched']).toBe('观看小时数');
    expect(uiZhCN.profile['Episode Count']).toBe('集数分布');
    expect(translateText('Action', { section: 'profile' })).toBe('动作');
    expect(translateText('Entries', { section: 'profile' })).toBe('部作品');
  });
  it('contains complete search and filter option translations', () => {
    expect(uiZhCN.search['Genres & Tags']).toBe('类型与标签');
    expect(uiZhCN.search.Any).toBe('不限');
    expect(uiZhCN.search['Not Yet Released']).toBe('尚未发布');
    expect(uiZhCN.search.Finished).toBe('已完结');
    expect(uiZhCN.search.Releasing).toBe('连载中');
    expect(uiZhCN.search.Original).toBe('原创');
    expect(uiZhCN.search['Light Novel']).toBe('轻小说');
    expect(uiZhCN.search.Winter).toBe('冬季');
    expect(uiZhCN.search.Summer).toBe('夏季');
    expect(uiZhCN.search.Popularity).toBe('人气');
    expect(translateText('Genres & Tags', { section: 'list' })).toBe('类型与标签');
    expect(translateText('Not Yet Released', { section: 'list' })).toBe('尚未发布');
    expect(translateText('4-koma', { section: 'list' })).toBe('四格漫画');
    expect(translateText('Achronological Order', { section: 'search' })).toBe('非线性叙事');
    expect(translateText('Cute Girls Doing Cute Things', { section: 'list' })).toBe('萌系少女日常');
    expect(translateText('4-koma', { section: 'media' })).toBe('四格漫画');
    expect(translateText('Coming of Age', { section: 'media' })).toBe('成长');
  });
  it('covers profile and account settings copy', () => {
    expect(translateText('A little about yourself...', { section: 'settings' })).toBe('简单介绍一下自己……');
    expect(translateText('Allowed Formats: JPEG, PNG. Max size: 3mb. Optimal dimensions: 230x230', { section: 'settings' })).toBe('支持 JPEG、PNG 格式，最大 3 MB，建议尺寸 230×230');
    expect(translateText('Data Cache improves load times by caching all data to your browser\'s local storage.', { section: 'settings' })).toBe('数据缓存会将数据保存到浏览器本地存储中，以加快加载速度。');
    expect(translateText('User Name', { section: 'settings' })).toBe('用户名');
    expect(translateText('Semi-Public', { section: 'settings' })).toBe('半公开');
    expect(translateText('Nobody except me can view my profile, lists, and activity.', { section: 'settings' })).toBe('除我之外，任何人都看不到我的资料、列表和动态。');
    expect(translateText('Delete User Account', { section: 'settings' })).toBe('删除账户');
  });
  it('covers media and list setting controls and options', () => {
    expect(translateText('Title Language', { section: 'settings' })).toBe('标题语言');
    expect(translateText('Romaji (Shingeki no Kyojin)', { section: 'settings' })).toBe('罗马字（Shingeki no Kyojin）');
    expect(translateText('Activity Merge Time', { section: 'settings' })).toBe('动态合并时间');
    expect(translateText('30 Minutes', { section: 'settings' })).toBe('30 分钟');
    expect(translateText('Scoring System', { section: 'settings' })).toBe('评分制');
    expect(translateText('Default List Order', { section: 'settings' })).toBe('默认列表排序');
    expect(translateText('Create an entry on your activity feed when your list updates.', { section: 'settings' })).toBe('列表更新时，在动态中发布一条记录。');
    expect(translateText('Reset Anime List Scores', { section: 'settings' })).toBe('清空动画列表评分');
  });
  it('covers notification, import, app and developer settings', () => {
    expect(translateText('Activity Subscriptions', { section: 'settings' })).toBe('动态订阅');
    expect(translateText('When someone replies to a forum thread I\'m subscribed to', { section: 'settings' })).toBe('有人回复我订阅的论坛主题时');
    expect(translateText('MyAnimeList: Import Anime List (Make sure to unzip the .xml.gz file first!)', { section: 'settings' })).toBe('MyAnimeList：导入动画列表（请先解压 .xml.gz 文件）');
    expect(translateText('Drop list xml file here or click to upload', { section: 'settings' })).toBe('将列表 XML 文件拖到此处，或点击上传');
    expect(translateText('Apps connected with your account', { section: 'settings' })).toBe('已连接到账户的应用');
    expect(translateText('Revoke App', { section: 'settings' })).toBe('取消应用授权');
    expect(translateText('Create New Client', { section: 'settings' })).toBe('创建新客户端');
    expect(translateText('(GMT+08:00) Hong Kong', { section: 'settings' })).toBe('(GMT+08:00) 香港');
  });
});
