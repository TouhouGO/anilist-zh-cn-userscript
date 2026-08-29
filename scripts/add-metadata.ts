import { readFile, writeFile } from 'node:fs/promises';
import { replaceUserscriptMetadata } from './userscript-metadata';

const file = 'dist/anilist-zh-cn.user.js';
const content = await readFile(file, 'utf8');
await writeFile(file, replaceUserscriptMetadata(content));
