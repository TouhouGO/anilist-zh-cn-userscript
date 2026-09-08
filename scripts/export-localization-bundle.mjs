import { writeFile, mkdir } from 'node:fs/promises';
import OpenCC from 'opencc-js';
import { tagZhCN } from '../src/data/tags/base.ts';
import { bangumiTagZhCN } from '../src/data/tags/community.ts';

await mkdir('data', { recursive: true });

// 1. Export merged tags_zh_cn.json (base + community)
const mergedTags = { ...tagZhCN, ...bangumiTagZhCN };
console.log(`Exporting ${Object.keys(mergedTags).length} tags...`);
await writeFile('data/tags_zh_cn.json', JSON.stringify(mergedTags, null, 2), 'utf8');

// 2. Export t2s_char_map.json (Traditional to Simplified Chinese character mapping)
console.log('Generating CJK Traditional to Simplified character mapping...');
const converter = OpenCC.Converter({ from: 't', to: 'cn' });
const t2sMap = {};
for (let code = 0x4e00; code <= 0x9fff; code++) {
  const char = String.fromCharCode(code);
  const converted = converter(char);
  if (converted !== char && converted.length === 1) {
    t2sMap[char] = converted;
  }
}
console.log(`Generated ${Object.keys(t2sMap).length} character mappings.`);
await writeFile('data/t2s_char_map.json', JSON.stringify(t2sMap), 'utf8');

// 3. Export staff_characters_zh_cn.json from Wikidata SPARQL
console.log('Fetching voice actors and characters from Wikidata...');
const staffCharMap = {};
const scoreMap = {};

function getLangScore(lang) {
  if (lang === 'zh-cn' || lang === 'zh-hans') return 3;
  if (lang === 'zh') return 2;
  return 1;
}

function setEntry(key, zh, score) {
  const existingScore = scoreMap[key] || 0;
  if (score >= existingScore) {
    staffCharMap[key] = zh;
    scoreMap[key] = score;
  }
}

async function fetchSparql(query) {
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query);
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'TouhouGO/anilist-zh-cn-userscript',
      'Accept': 'application/sparql-results+json'
    }
  });
  if (!resp.ok) throw new Error(`SPARQL HTTP ${resp.status}`);
  const data = await resp.json();
  return data.results.bindings;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanZh(str) {
  let res = converter(str);
  res = res.replace(/水树奈々/g, '水树奈奈');
  return res;
}

// 3.1 Fetch AniList Staff (P11227)
try {
  console.log('Fetching AniList native staff (P11227)...');
  const staffQuery = `
    SELECT ?id ?enLabel ?label (LANG(?label) as ?lang) WHERE {
      ?item wdt:P11227 ?id .
      ?item rdfs:label ?label .
      FILTER(LANG(?label) IN ('zh', 'zh-cn', 'zh-hans', 'zh-tw', 'zh-hk', 'zh-hant'))
      OPTIONAL {
        ?item rdfs:label ?enLabel .
        FILTER(LANG(?enLabel) = 'en')
      }
    } LIMIT 25000
  `;
  const staffResults = await fetchSparql(staffQuery);
  for (const b of staffResults) {
    const rawId = b.id.value;
    const zh = cleanZh(b.label.value);
    const score = getLangScore(b.lang?.value);
    setEntry('person_' + rawId, zh, score);

    if (b.enLabel?.value) {
      const en = b.enLabel.value.trim();
      setEntry('name_' + normalizeName(en), zh, score);
      const parts = en.split(/\s+/);
      if (parts.length === 2) {
        setEntry('name_' + normalizeName(`${parts[1]} ${parts[0]}`), zh, score);
      }
    }
  }
  console.log(`Processed ${staffResults.length} AniList staff bindings.`);
} catch (e) {
  console.warn('Failed to fetch AniList staff from Wikidata:', e.message);
}

// 3.2 Fetch AniList Characters (P11736)
try {
  console.log('Fetching AniList native characters (P11736)...');
  const charQuery = `
    SELECT ?id ?enLabel ?label (LANG(?label) as ?lang) WHERE {
      ?item wdt:P11736 ?id .
      ?item rdfs:label ?label .
      FILTER(LANG(?label) IN ('zh', 'zh-cn', 'zh-hans', 'zh-tw', 'zh-hk', 'zh-hant'))
      OPTIONAL {
        ?item rdfs:label ?enLabel .
        FILTER(LANG(?enLabel) = 'en')
      }
    } LIMIT 15000
  `;
  const charResults = await fetchSparql(charQuery);
  for (const b of charResults) {
    const rawId = b.id.value;
    const zh = cleanZh(b.label.value);
    const score = getLangScore(b.lang?.value);
    setEntry('char_' + rawId, zh, score);

    if (b.enLabel?.value) {
      const en = b.enLabel.value.trim();
      setEntry('name_' + normalizeName(en), zh, score);
      const parts = en.split(/\s+/);
      if (parts.length === 2) {
        setEntry('name_' + normalizeName(`${parts[1]} ${parts[0]}`), zh, score);
      }
    }
  }
  console.log(`Processed ${charResults.length} AniList character bindings.`);
} catch (e) {
  console.warn('Failed to fetch AniList characters from Wikidata:', e.message);
}

// 3.3 Fetch MAL People (P4084) for legacy MAL ID offset (+95000)
try {
  console.log('Fetching MAL staff with AniList legacy offset (P4084)...');
  const malStaffQuery = `
    SELECT ?id ?enLabel ?label (LANG(?label) as ?lang) WHERE {
      ?item wdt:P4084 ?id .
      ?item rdfs:label ?label .
      FILTER(LANG(?label) IN ('zh', 'zh-cn', 'zh-hans', 'zh-tw', 'zh-hk', 'zh-hant'))
      OPTIONAL {
        ?item rdfs:label ?enLabel .
        FILTER(LANG(?enLabel) = 'en')
      }
    } LIMIT 10000
  `;
  const malStaffResults = await fetchSparql(malStaffQuery);
  for (const b of malStaffResults) {
    const rawId = b.id.value;
    const zh = cleanZh(b.label.value);
    const score = getLangScore(b.lang?.value) - 0.1; // slightly lower score than native
    const numId = Number(rawId);
    if (!isNaN(numId) && numId < 50000) {
      setEntry('person_' + (numId + 95000), zh, score);
    }
    if (b.enLabel?.value) {
      const en = b.enLabel.value.trim();
      setEntry('name_' + normalizeName(en), zh, score);
      const parts = en.split(/\s+/);
      if (parts.length === 2) {
        setEntry('name_' + normalizeName(`${parts[1]} ${parts[0]}`), zh, score);
      }
    }
  }
  console.log(`Processed ${malStaffResults.length} MAL staff bindings.`);
} catch (e) {
  console.warn('Failed to fetch MAL staff from Wikidata:', e.message);
}

await writeFile('data/staff_characters_zh_cn.json', JSON.stringify(staffCharMap, null, 2), 'utf8');
console.log(`Exported total ${Object.keys(staffCharMap).length} staff & character entries.`);
console.log('Localization bundle assets generation complete!');
