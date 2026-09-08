import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { uiZhCN } from '../src/data/ui';
import { bangumiTagZhCN, tagZhCN } from '../src/data/tags';
import { titleOverrides } from '../src/data/titles/overrides';
import { findDuplicateObjectKeys, validateDictionaryData } from './dictionary-rules';

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listTypeScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

const errors = validateDictionaryData({
  ui: uiZhCN,
  baseTags: tagZhCN,
  communityTags: bangumiTagZhCN,
  titleOverrides,
});

for (const path of await listTypeScriptFiles('src/data')) {
  const fileName = relative('.', path);
  errors.push(...findDuplicateObjectKeys(await readFile(path, 'utf8'), fileName));
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('词典检查通过');
}
