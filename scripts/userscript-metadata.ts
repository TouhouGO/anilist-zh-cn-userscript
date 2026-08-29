export const userscriptVersion = '0.1.13';

export const userscriptMetadata = `// ==UserScript==
// @name         AniList 简体中文
// @namespace    https://github.com/TouhouGO/anilist-zh-cn-userscript
// @version      ${userscriptVersion}
// @description  将 AniList 界面和作品标题显示为简体中文
// @match        https://anilist.co/*
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.bgm.tv
// @connect      graphql.anilist.co
// @updateURL    https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js
// @downloadURL  https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js
// ==/UserScript==
`;

const metadataPattern = /^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m;

export function replaceUserscriptMetadata(content: string): string {
  const body = content.replace(metadataPattern, '');
  return userscriptMetadata + body;
}
