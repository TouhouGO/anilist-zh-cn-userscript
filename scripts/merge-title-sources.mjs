import { mkdir, writeFile, readFile } from 'node:fs/promises';
import OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 't', to: 'cn' });
const mainlandTerms = [
  ['動畫', '动画'], ['漫畫', '漫画'], ['電視', '电视'], ['劇場版', '剧场版'],
  ['特別篇', '特别篇'], ['特別編', '特别篇'], ['聲優', '声优'], ['聲', '声'],
  ['學', '学'], ['國', '国'], ['後', '后'], ['裡面', '里面'], ['裡', '里'],
  ['這', '这'], ['個', '个'], ['來', '来'], ['說', '说'], ['會', '会'],
  ['與', '与'], ['為', '为'], ['臺', '台'],
];

function normalizeChinese(text) {
  if (!text) return '';
  let res = converter(text.trim());
  for (const [from, to] of mainlandTerms) {
    res = res.replaceAll(from, to);
  }
  return res.trim();
}

const bangumiDataUrl = 'https://unpkg.com/bangumi-data@0.3/dist/data.json';
const anilistChineseUrl = 'https://raw.githubusercontent.com/soruly/anilist-chinese/master/anilist-chinese.json';

console.log('Fetching upstream sources...');
const [bangumiResponse, anilistResponse] = await Promise.all([
  fetch(bangumiDataUrl),
  fetch(anilistChineseUrl),
]);

if (!bangumiResponse.ok || !anilistResponse.ok) {
  throw new Error(`source fetch failed: bangumi-data=${bangumiResponse.status}, anilist-chinese=${anilistResponse.status}`);
}

const [bangumiData, anilistChinese] = await Promise.all([
  bangumiResponse.json(),
  anilistResponse.json(),
]);

const mergedById = new Map();
const nativeToChinese = new Map();

// 1. Ingest soruly/anilist-chinese (Anime, ~8.5k entries)
for (const item of anilistChinese) {
  if (item.id && item.title?.trim()) {
    const title = normalizeChinese(item.title);
    if (title) {
      mergedById.set(Number(item.id), {
        id: Number(item.id),
        title,
        native: '',
        source: 'anilist-chinese',
      });
    }
  }
}

// 2. Ingest bangumi-data (Anime, ~10k entries, highest quality for anime)
for (const item of bangumiData.items || []) {
  const aniListSite = item.sites?.find((entry) => entry.site === 'aniList');
  const bangumiSite = item.sites?.find((entry) => entry.site === 'bangumi');
  const rawZh = item.titleTranslate?.['zh-Hans']?.[0]?.trim() || item.titleTranslate?.['zh-Hant']?.[0]?.trim();
  const title = rawZh ? normalizeChinese(rawZh) : normalizeChinese(item.title);
  const native = item.title?.trim() || '';
  const bangumiId = bangumiSite?.id ? Number(bangumiSite.id) : undefined;

  if (native && title && native !== title) {
    nativeToChinese.set(native, title);
  }

  if (aniListSite?.id && title) {
    mergedById.set(Number(aniListSite.id), {
      id: Number(aniListSite.id),
      title,
      native,
      bangumiId,
      source: 'bangumi-data',
    });
  }
}

// 3. Ingest Wikidata Manga & Cross-mappings (Manga + Light Novels, ~4k entries)
console.log('Fetching Wikidata manga cross-references...');
try {
  const sparqlQuery = `
    SELECT ?anilist_id ?bangumi_id ?label ?lang WHERE {
      ?item wdt:P8731 ?anilist_id .
      ?item rdfs:label ?label .
      BIND(LANG(?label) AS ?lang)
      FILTER(?lang IN ('zh-cn', 'zh-hans', 'zh', 'zh-tw', 'zh-hant', 'zh-hk'))
      OPTIONAL { ?item wdt:P5732 ?bangumi_id }
    }
  `;
  const sparqlUrl = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparqlQuery);
  const sparqlRes = await fetch(sparqlUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AniList-CN-Pipeline/1.0 (https://github.com/TouhouGO/anilist-zh-cn-userscript)',
    },
  });

  if (sparqlRes.ok) {
    const sparqlData = await sparqlRes.json();
    const bindings = sparqlData.results?.bindings || [];
    console.log(`Received ${bindings.length} Wikidata manga records`);

    const langRank = (lang) => {
      if (lang === 'zh-cn' || lang === 'zh-hans') return 3;
      if (lang === 'zh') return 2;
      if (lang === 'zh-tw' || lang === 'zh-hant' || lang === 'zh-hk') return 1;
      return 0;
    };

    for (const b of bindings) {
      const anilistId = Number(b.anilist_id?.value);
      const bangumiId = b.bangumi_id?.value ? Number(b.bangumi_id.value) : undefined;
      const rawLabel = b.label?.value?.trim();
      const lang = b.lang?.value;
      const rank = langRank(lang);

      if (anilistId && rawLabel) {
        const title = normalizeChinese(rawLabel);
        if (title) {
          const existing = mergedById.get(anilistId);
          if (!existing) {
            mergedById.set(anilistId, {
              id: anilistId,
              title,
              native: '',
              bangumiId,
              source: 'wikidata-manga',
              rank,
            });
          } else if (existing.source === 'wikidata-manga' && rank > (existing.rank || 0)) {
            existing.title = title;
            existing.rank = rank;
            if (bangumiId) existing.bangumiId = bangumiId;
          }
        }
      }
    }
  } else {
    console.warn(`Wikidata query returned status ${sparqlRes.status}`);
  }
} catch (err) {
  console.warn(`Wikidata query failed, continuing with existing sources:`, err.message);
}

// 4. Ingest and apply titleOverrides (Mainland community standards)
let titleOverrides = {};
try {
  const content = await readFile('src/data/titles/overrides.ts', 'utf8');
  const match = content.match(/titleOverrides\s*:\s*Record<[^>]+>\s*=\s*(\{[\s\S]*?\});/);
  if (match) {
    titleOverrides = Function(`return (${match[1]})`)();
  }
} catch (e) {
  console.warn('Could not read overrides.ts:', e.message);
}

for (const [idStr, overrideTitle] of Object.entries(titleOverrides)) {
  const numId = Number(idStr);
  const existing = mergedById.get(numId);
  if (existing) {
    existing.title = overrideTitle;
  } else {
    mergedById.set(numId, { id: numId, title: overrideTitle, native: '', source: 'override' });
  }
}

const merged = [...mergedById.values()];
merged.sort((a, b) => a.id - b.id);

await mkdir('data', { recursive: true });
await writeFile(
  'data/title-supplement.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sources: [bangumiDataUrl, anilistChineseUrl, 'wikidata'],
      entries: merged,
    },
    null,
    2,
  ) + '\n',
);

// High-density key-value map for Android App & lightweight lookups:
// Keys can be:
// 1. Numeric string AniList IDs ("116266": "女友成双|...", "30002": "剑风传奇|9640")
// 2. Native original title fallback ("カノジョも彼女": "女友成双")
const compactMap = {};
for (const item of merged) {
  if (item.bangumiId) {
    compactMap[item.id] = `${item.title}|${item.bangumiId}`;
  } else {
    compactMap[item.id] = item.title;
  }
}
for (const [native, zh] of nativeToChinese) {
  if (!compactMap[native]) {
    compactMap[native] = zh;
  }
}

await writeFile('data/titles_zh_cn.json', JSON.stringify(compactMap) + '\n');

console.log(`Merged ${merged.length} AniList titles into data/title-supplement.json`);
console.log(`Generated compact data/titles_zh_cn.json (${Object.keys(compactMap).length} entries: ${merged.length} by ID, ${nativeToChinese.size} by native fallback)`);
