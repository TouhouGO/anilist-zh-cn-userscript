import { mkdir, writeFile } from 'node:fs/promises';

const bangumiDataUrl = 'https://unpkg.com/bangumi-data@0.3/dist/data.json';
const anilistChineseUrl = 'https://raw.githubusercontent.com/soruly/anilist-chinese/master/anilist-chinese.json';
const [bangumiResponse, anilistResponse] = await Promise.all([fetch(bangumiDataUrl), fetch(anilistChineseUrl)]);
if (!bangumiResponse.ok || !anilistResponse.ok) throw new Error(`source fetch failed: bangumi-data=${bangumiResponse.status}, anilist-chinese=${anilistResponse.status}`);
const [bangumiData, anilistChinese] = await Promise.all([bangumiResponse.json(), anilistResponse.json()]);
const mergedById = new Map();
for (const item of anilistChinese) if (item.id && item.title?.trim()) mergedById.set(Number(item.id), { id: Number(item.id), title: item.title.trim(), native: '', source: 'anilist-chinese' });
for (const item of bangumiData.items || []) {
  const site = item.sites?.find((entry) => entry.site === 'aniList');
  const title = item.titleTranslate?.['zh-Hans']?.[0]?.trim();
  const bangumiSite = item.sites?.find((entry) => entry.site === 'bangumi');
  if (site?.id && title) mergedById.set(Number(site.id), { id: Number(site.id), title, native: item.title || '', bangumiId: bangumiSite?.id ? Number(bangumiSite.id) : undefined, source: 'bangumi-data' });
}
const merged = [...mergedById.values()];
merged.sort((a, b) => a.id - b.id);
await mkdir('data', { recursive: true });
await writeFile('data/title-supplement.json', JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), sources: [bangumiDataUrl, anilistChineseUrl], entries: merged }, null, 2) + '\n');
console.log(`merged ${merged.length} AniList titles into data/title-supplement.json`);
