import { readFile, writeFile } from 'node:fs/promises';
import { replaceUserscriptMetadata } from './userscript-metadata';

const anilistFile = 'dist/anilist-zh-cn.user.js';
const anilistContent = await readFile(anilistFile, 'utf8');
await writeFile(anilistFile, replaceUserscriptMetadata(anilistContent));
