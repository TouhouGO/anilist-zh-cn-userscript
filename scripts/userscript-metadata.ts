export const userscriptVersion = '0.1.24';

export const userscriptMetadata = `// ==UserScript==
// @name         AniList 简体中文
// @namespace    https://github.com/TouhouGO/anilist-zh-cn-userscript
// @version      ${userscriptVersion}
// @description  将 AniList 界面、作品标题和人物名称显示为简体中文
// @match        https://anilist.co/*
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.bgm.tv
// @connect      graphql.anilist.co
// @connect      query.wikidata.org
// @connect      raw.githubusercontent.com
// @connect      fastly.jsdelivr.net
// @connect      testingcf.jsdelivr.net
// @updateURL    https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js
// @downloadURL  https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js
// ==/UserScript==
`;

const metadataPattern = /^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m;

export function replaceUserscriptMetadata(content: string): string {
  const body = content.replace(metadataPattern, '');
  return userscriptMetadata + body;
}
