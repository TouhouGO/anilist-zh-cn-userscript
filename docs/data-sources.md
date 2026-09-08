# 数据来源

脚本将人工词典、人工修正和自动生成数据分开维护。优先级由高到低为：人工修正、内置补充库、运行时更新、AniList 原始标题。

## 当前使用

| 项目 | 用途 | 许可 |
| --- | --- | --- |
| [TouhouGO/anilist-zh-cn-userscript](https://github.com/TouhouGO/anilist-zh-cn-userscript) | 官方构建整合的 `titles_zh_cn.json`，用于客户端打包内置及增量运行时更新 | [MIT](LICENSE) |
| [soruly/anilist-chinese](https://github.com/soruly/anilist-chinese) | 离线合并标题源之一（AniList ID 对应中文标题） | [MIT](https://github.com/soruly/anilist-chinese/blob/master/LICENSE) |
| [bangumi-data/bangumi-data](https://github.com/bangumi-data/bangumi-data) | 通过 AniList 外部 ID 合并中文标题和 Bangumi 条目 ID | [CC BY 4.0](https://github.com/bangumi-data/bangumi-data#license) |
| [nk2028/opencc-js](https://github.com/nk2028/opencc-js) | 将标题统一转换为大陆简体中文 | [MIT](https://github.com/nk2028/opencc-js/blob/main/LICENSE) |
| [AniList GraphQL API](https://docs.anilist.co/) | 中文搜索结果的作品封面 | AniList API 条款 |
| [Wikidata Query Service](https://query.wikidata.org/) | 通过 AniList Character ID（P11736）和 Staff ID（P11227）查询中文名称 | [CC0](https://www.wikidata.org/wiki/Wikidata:Copyright) |
| [Bangumi API](https://bangumi.github.io/api/) | 已映射作品的中文标签语境与人物名称补充 | Bangumi API 条款 |

`bangumi-data` 要求保留来源署名，本项目在 README 和本页持续标注其用途。上游数据的版权及许可继续归各自项目和权利人所有。

## 生成规则

`npm run merge-titles` 从标题数据源生成 `data/titles_zh_cn.json` 与 `data/title-supplement.json`：

1. 以 AniList ID 作为唯一键，不做模糊标题匹配。
2. `bangumi-data` 中带 `zh-Hans` 且有 AniList ID 的记录优先，并提取 Bangumi 条目关联。
3. `anilist-chinese` 补充其余动画条目。
4. Wikidata SPARQL 实时补充漫画与轻小说跨站中文条目。
5. 提取日文原名回退直译索引，并最终导出供前端打包与轻量增量更新的 `data/titles_zh_cn.json`。

大型生成文件适合整体更新；单条纠错放入 `src/data/titles/overrides.ts`。

## 人物与角色名称

人物名称按以下顺序解析：

1. `src/data/entities/overrides.ts` 中少量可核验的人工纠错。
2. Wikidata 的 AniList Character ID（P11736）或 AniList Staff ID（P11227）直接映射。
3. Wikidata 缺失时，在已映射的同一 Bangumi 作品内用日文原名做唯一完全匹配。
4. 匹配缺失或有歧义时保留 AniList 原名。

有效名称在浏览器本地缓存 30 天，未命中缓存 7 天。脚本不打包完整人物数据库，也不上传用户信息或缓存。
