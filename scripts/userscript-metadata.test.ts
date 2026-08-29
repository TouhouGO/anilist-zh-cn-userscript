import { describe, expect, it } from 'vitest';
import { replaceUserscriptMetadata, userscriptMetadata, userscriptVersion } from './userscript-metadata';

describe('userscript metadata', () => {
  it('defines the public install and update metadata in one canonical block', () => {
    expect(userscriptVersion).toBe('0.1.14');
    expect(userscriptMetadata).toContain('// @namespace    https://github.com/TouhouGO/anilist-zh-cn-userscript');
    expect(userscriptMetadata).toContain('// @updateURL    https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js');
    expect(userscriptMetadata).toContain('// @downloadURL  https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js');
    expect(userscriptMetadata).toContain('// @connect      api.bgm.tv');
    expect(userscriptMetadata).toContain('// @connect      graphql.anilist.co');
    expect(userscriptMetadata).toContain('// @connect      query.wikidata.org');
  });

  it('replaces an outdated metadata block instead of creating a duplicate', () => {
    const old = `// ==UserScript==\n// @version 0.1.0\n// ==/UserScript==\nconsole.log('ready');\n`;
    const result = replaceUserscriptMetadata(old);

    expect(result.match(/\/\/ ==UserScript==/g)).toHaveLength(1);
    expect(result).toContain('// @version      0.1.14');
    expect(result).not.toContain('@version 0.1.0');
    expect(result.endsWith("console.log('ready');\n")).toBe(true);
  });
});
