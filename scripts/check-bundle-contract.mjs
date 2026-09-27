import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Computes the number of Unicode code points in a string.
 *
 * NOTE: Kotlin's String.codePointCount counts Unicode code points. In JavaScript,
 * string.length returns UTF-16 code units. Astral plane characters (such as emojis
 * and CJK Extension characters) take 2 code units (surrogate pairs) but represent
 * exactly 1 Unicode code point. [...str].length invokes the string iterator which
 * traverses Unicode code points, matching Kotlin's codePointCount behavior and
 * preventing false positives.
 */
export function getCodePointCount(str) {
  if (typeof str !== 'string') return 0;
  return [...str].length;
}

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F-\u009F]/;
const INTEGER_REGEX = /^[-+]?\d+$/;
const STAFF_KEY_REGEX = /^(person_\d+|char_\d+|name_[a-z0-9_]+|id_\d+)$/;
const MAX_INT_32 = 2147483647;

export function validateTitles(titles) {
  const errors = [];
  if (!titles || typeof titles !== 'object' || Array.isArray(titles)) {
    return ['titles_zh_cn.json must be a JSON object (Map<String, String>)'];
  }
  const entries = Object.entries(titles);
  if (entries.length === 0) {
    return ['titles_zh_cn.json must not be empty'];
  }

  for (const [key, value] of entries) {
    if (typeof value !== 'string') {
      errors.push(`titles_zh_cn.json contains non-string value for key: ${key}`);
      continue;
    }
    const trimmedKey = key.trim();
    const trimmedVal = value.trim();
    if (trimmedKey.length === 0 || trimmedVal.length === 0) {
      errors.push(`titles_zh_cn.json contains blank key or value: key="${key}", value="${value}"`);
    }
    if (CONTROL_CHAR_REGEX.test(key)) {
      errors.push(`titles_zh_cn.json key contains control character: ${JSON.stringify(key)}`);
    }
    if (getCodePointCount(key) > 256) {
      errors.push(`titles_zh_cn.json key exceeds 256 code points: ${key.slice(0, 30)}...`);
    }
    if (getCodePointCount(value) > 512) {
      errors.push(`titles_zh_cn.json value exceeds 512 code points: ${value.slice(0, 30)}...`);
    }

    const isNumericKey = INTEGER_REGEX.test(key);
    if (isNumericKey) {
      const num = Number(key);
      if (!Number.isInteger(num) || num <= 0 || num > MAX_INT_32) {
        errors.push(`titles_zh_cn.json numeric key must parse to positive Int: ${key}`);
      }
    }

    if (value.includes('|')) {
      if (!isNumericKey) {
        errors.push(`titles_zh_cn.json entry with pipe '|' must have numeric key: ${key}`);
      }
      const lastPipe = value.lastIndexOf('|');
      const bgmIdStr = value.slice(lastPipe + 1);
      const bgmId = Number(bgmIdStr);
      if (!/^\d+$/.test(bgmIdStr) || !Number.isInteger(bgmId) || bgmId <= 0 || bgmId > MAX_INT_32) {
        errors.push(`titles_zh_cn.json contains invalid Bangumi ID after pipe: ${value}`);
      }
    }
  }

  return errors;
}

export function validateTags(tags) {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
    return ['tags_zh_cn.json must be a JSON object (Map<String, String>)'];
  }
  const entries = Object.entries(tags);
  if (entries.length === 0) {
    return ['tags_zh_cn.json must not be empty'];
  }
  const errors = [];
  for (const [key, value] of entries) {
    if (typeof value !== 'string') {
      errors.push(`tags_zh_cn.json contains non-string value for key: ${key}`);
      continue;
    }
    if (key.trim().length === 0 || value.trim().length === 0) {
      errors.push(`tags_zh_cn.json contains blank key or value: key="${key}"`);
    }
  }
  return errors;
}

export function validateStaffCharacters(staff) {
  if (!staff || typeof staff !== 'object' || Array.isArray(staff)) {
    return ['staff_characters_zh_cn.json must be a JSON object (Map<String, String>)'];
  }
  const entries = Object.entries(staff);
  if (entries.length === 0) {
    return ['staff_characters_zh_cn.json must not be empty'];
  }
  const errors = [];
  for (const [key, value] of entries) {
    if (!STAFF_KEY_REGEX.test(key)) {
      errors.push(`staff_characters_zh_cn.json contains invalid key pattern: ${key}`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`staff_characters_zh_cn.json contains blank or non-string value for key: ${key}`);
    }
  }
  return errors;
}

export function validateT2sCharMap(t2s) {
  if (!t2s || typeof t2s !== 'object' || Array.isArray(t2s)) {
    return ['t2s_char_map.json must be a JSON object (Map<String, String>)'];
  }
  const entries = Object.entries(t2s);
  if (entries.length === 0) {
    return ['t2s_char_map.json must not be empty'];
  }
  const errors = [];
  for (const [key, value] of entries) {
    const keyCount = getCodePointCount(key);
    const valCount = typeof value === 'string' ? getCodePointCount(value) : 0;
    if (keyCount !== 1 || valCount !== 1) {
      errors.push(`t2s_char_map.json contains multi-codepoint mapping: '${key}' -> '${value}'`);
    }
  }
  return errors;
}

export function checkBundleContract({ titles, tags, staffCharacters, t2sCharMap }) {
  const errors = [
    ...validateTitles(titles),
    ...validateTags(tags),
    ...validateStaffCharacters(staffCharacters),
    ...validateT2sCharMap(t2sCharMap),
  ];

  const counts = {
    titles: titles && typeof titles === 'object' && !Array.isArray(titles) ? Object.keys(titles).length : 0,
    tags: tags && typeof tags === 'object' && !Array.isArray(tags) ? Object.keys(tags).length : 0,
    staffCharacters: staffCharacters && typeof staffCharacters === 'object' && !Array.isArray(staffCharacters) ? Object.keys(staffCharacters).length : 0,
    t2sCharMap: t2sCharMap && typeof t2sCharMap === 'object' && !Array.isArray(t2sCharMap) ? Object.keys(t2sCharMap).length : 0,
  };

  return {
    valid: errors.length === 0,
    errors,
    counts,
  };
}

export async function loadAndCheckBundle(dataDir = 'data') {
  const titles = JSON.parse(await readFile(join(dataDir, 'titles_zh_cn.json'), 'utf8'));
  const tags = JSON.parse(await readFile(join(dataDir, 'tags_zh_cn.json'), 'utf8'));
  const staffCharacters = JSON.parse(await readFile(join(dataDir, 'staff_characters_zh_cn.json'), 'utf8'));
  const t2sCharMap = JSON.parse(await readFile(join(dataDir, 't2s_char_map.json'), 'utf8'));

  return checkBundleContract({ titles, tags, staffCharacters, t2sCharMap });
}

// CLI entry point
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const dataDir = process.argv[2] || 'data';
    const result = await loadAndCheckBundle(dataDir);

    console.log(`titles_zh_cn.json: ${result.counts.titles} entries`);
    console.log(`tags_zh_cn.json: ${result.counts.tags} entries`);
    console.log(`staff_characters_zh_cn.json: ${result.counts.staffCharacters} entries`);
    console.log(`t2s_char_map.json: ${result.counts.t2sCharMap} entries`);

    if (!result.valid) {
      console.error(`\nBundle contract check failed with ${result.errors.length} error(s):`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }

    console.log('\nBundle contract check passed');
  } catch (err) {
    console.error('Fatal error checking bundle contract:', err.message);
    process.exit(1);
  }
}
