# AniList 简体中文用户脚本

面向 [AniList](https://anilist.co/) 的简体中文用户脚本，将主要界面、筛选项、状态文案、标签和动画/漫画标题显示为更符合中国大陆动漫社区习惯的中文。

> 本项目目前由个人使用需求发展而来，正在持续整理为便于社区共同维护的项目。它不是 AniList 官方项目。

## 安装

先安装 [ScriptCat](https://scriptcat.org/)、[Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)，再打开下面的链接：

### [一键安装 AniList 简体中文脚本](https://raw.githubusercontent.com/TouhouGO/anilist-zh-cn-userscript/main/dist/anilist-zh-cn.user.js)
脚本匹配 `https://anilist.co/*`，更新地址与安装地址相同。

## 功能范围

| 范围 | 当前状态 |
| --- | --- |
| 导航、按钮、菜单、设置、弹窗和状态文案 | 主要页面已覆盖，持续补漏 |
| 搜索、筛选、排序、类型和标签 | 已覆盖，标签持续人工复核 |
| 动画与漫画中文标题 | 已覆盖各种列表视图（详细表格、紧凑表格、网格卡片等）、详情、悬浮层和动态等常见位置 |
| 中文标题搜索 | 支持搜索页和右上角全站搜索，结果显示中文标题与封面 |
| 个人资料、列表和统计 | 主要界面已覆盖 |
| 角色、声优与制作人员姓名 | 首版已接入：Wikidata 直接 ID 为主，Bangumi 同作品精确匹配补全 |
| 剧情简介 | 支持联动 Bangumi API 获取中文剧情简介（匹配成功时纯中文呈现），未收录或未匹配时保持原文 |
| 评论、动态和论坛正文 | 保持原文 |

当前已为 AniList 的 428 个标签建立基础简体中文词典，并使用大陆动漫社区语境修正部分译名。页面结构更新后出现的漏译或兼容问题会持续跟进。

## 词典怎么维护

```text
src/data/
├── ui/                 # 按页面拆分的界面词典
├── tags/
│   ├── base.ts         # AniList 标签基础译名
│   └── community.ts    # 大陆社区语境优先修正
├── titles/
│   └── overrides.ts    # 少量作品标题人工修正
├── entities/
│   └── overrides.ts    # 少量人物/角色名称纠错
├── ui-zh-CN.ts         # 稳定聚合入口
├── tag-zh-CN.ts        # 稳定聚合入口
└── title-overrides.ts  # 稳定聚合入口

data/
├── titles_zh_cn.json           # 核心字典：紧凑键值库，供脚本内嵌、在线增量更新及移动端同步
├── title-supplement.json       # 标题合并全量结构数据（供 CI 自动化测试与离线核验）
├── tag-translation-review.csv  # 标签审阅复核记录
└── *.json                      # 供移动端热更同步的衍生资源包（tags、characters 等）
```

词典键保留 AniList 页面英文原文，译文采用中国大陆动画、漫画社区常用表达。人工修正优先于基础词典，自动生成数据不会覆盖人工修正。

想修正一个译名或补充漏译，可直接阅读 [参与贡献](CONTRIBUTING.md) 和简短的 [翻译规范](docs/translation-guide.md)。GitHub 的翻译、问题和建议模板也已提供所需信息清单。

## 本地开发

```bash
npm install                 # 安装开发依赖
npm test                    # 运行自动测试
npm run typecheck           # 检查 TypeScript 类型
npm run check:dictionary    # 检查词典结构、空值、重复键和无意义覆盖
npm run build               # 生成 dist/anilist-zh-cn.user.js
npm run coverage            # 检查关键模块覆盖率
npm run check               # 依次完成全部发布前检查
npm run merge-titles        # 重新合并上游标题数据
npm run export-bundle       # 导出供移动端热更同步的本地化资源包
```

`merge-titles` 会按 AniList ID 合并 Bangumi Data、AniList Chinese 与 Wikidata 漫画/轻小说，不使用模糊标题匹配。大型标题补充库由该命令生成；单条标题纠错请修改 `src/data/titles/overrides.ts`。

## 网络与隐私

脚本只在 AniList 页面运行。它会读取页面中的作品 ID，并按需请求：

- AniList GraphQL API：补充中文搜索结果封面，并读取待匹配人物的公开日文原名；
- Wikidata Query Service：按 AniList 人物/角色 ID 批量查询中文名称；
- Bangumi API：获取已映射作品的中文剧情简介、补充已可靠映射作品的标签语境，以及补充 Wikidata 缺失的人物名称；
- 本项目官方整合源（GitHub Raw）：定期增量同步更新的中文标题库（`titles_zh_cn.json`）。

标题、人物名称与剧情简介缓存保存在浏览器独立存储（优先使用 `GM_getValue`，降级至 `localStorage`）中。人物名称与简介命中缓存 30 天，未命中缓存 7 天。项目没有遥测或后端服务，也不上传 AniList 账号、列表、搜索记录、浏览历史及本地缓存。

## 数据来源与致谢

- [TouhouGO/anilist-zh-cn-userscript](https://github.com/TouhouGO/anilist-zh-cn-userscript)：官方自动化整合与持续构建的中文标题数据，MIT。
- [soruly/anilist-chinese](https://github.com/soruly/anilist-chinese)：AniList 作品中文标题离线合并参考，MIT。
- [bangumi-data/bangumi-data](https://github.com/bangumi-data/bangumi-data)：作品标题、外部站点 ID 和标题映射，数据采用 CC BY 4.0。
- [nk2028/opencc-js](https://github.com/nk2028/opencc-js)：繁体中文转大陆简体中文，MIT。
- [Wikidata](https://www.wikidata.org/)：通过 AniList Character ID 与 Staff ID 获取公开中文名称，CC0。

详细用途、优先级和许可说明见 [数据来源](docs/data-sources.md)。感谢这些项目及其贡献者维护开放数据。

## 许可证

项目自有代码采用 [MIT License](LICENSE)。引用或生成的数据继续遵守对应上游项目的许可与署名要求。
