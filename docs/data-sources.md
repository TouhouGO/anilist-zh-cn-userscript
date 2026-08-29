# 数据来源

脚本将人工词典、人工修正和自动生成数据分开维护。优先级由高到低为：人工修正、内置补充库、运行时更新、AniList 原始标题。

## 当前使用

| 项目 | 用途 | 许可 |
| --- | --- | --- |
| [soruly/anilist-chinese](https://github.com/soruly/anilist-chinese) | AniList ID 对应的中文标题，以及运行时标题更新 | [MIT](https://github.com/soruly/anilist-chinese/blob/master/LICENSE) |
| [bangumi-data/bangumi-data](https://github.com/bangumi-data/bangumi-data) | 通过 AniList/MAL 外部 ID 合并中文标题和 Bangumi 条目 ID | [CC BY 4.0](https://github.com/bangumi-data/bangumi-data#license) |
| [nk2028/opencc-js](https://github.com/nk2028/opencc-js) | 将标题统一转换为大陆简体中文 | [MIT](https://github.com/nk2028/opencc-js/blob/main/LICENSE) |
| [AniList GraphQL API](https://docs.anilist.co/) | 中文搜索结果的作品封面 | AniList API 条款 |
| [Bangumi API](https://bangumi.github.io/api/) | 已映射作品的中文标签语境补充 | Bangumi API 条款 |

`bangumi-data` 要求保留来源署名，本项目在 README 和本页持续标注其用途。上游数据的版权及许可继续归各自项目和权利人所有。

## 研究参考

[nz3u/bangumi-data](https://github.com/nz3u/bangumi-data) 提供 Bangumi 条目、人物和角色的查询与导出能力，采用 [GPL-3.0](https://github.com/nz3u/bangumi-data/blob/main/LICENSE)。当前发布脚本未直接打包该仓库的数据，后续建立可靠的 AniList 人物/角色跨站映射时可作为研究来源。

## 生成规则

`npm run merge-titles` 从标题数据源生成 `data/title-supplement.json`：

1. 以 AniList ID 作为唯一键，不做模糊标题匹配。
2. `bangumi-data` 中带 `zh-Hans` 且有 AniList ID 的记录优先。
3. `anilist-chinese` 补充其余条目。
4. 结果按 AniList ID 升序输出，并通过自动测试检查唯一性。

大型生成文件适合整体更新；单条纠错放入 `src/data/titles/overrides.ts`。
