# 参与贡献

感谢你帮助完善 AniList 简体中文用户脚本。漏译、错译、页面兼容问题和代码改进都欢迎提交。

## 从哪里修改

### 界面文案

界面词典位于 `src/data/ui/`，按页面分文件：

- `global.ts`：导航和通用按钮
- `home.ts`：首页
- `search.ts`：搜索、筛选和类型
- `media.ts`：作品详情页
- `list.ts`：动画/漫画列表
- `profile.ts`：个人资料和统计
- `forum.ts`：论坛
- `notifications.ts`：通知
- `settings.ts`：设置

键填写 AniList 页面显示的英文原文，值填写简体中文。新增页面域时，同时更新 `src/data/ui/index.ts` 和相关测试。

### 标签译名

- `src/data/tags/base.ts`：AniList 标签的基础简体中文词典。
- `src/data/tags/community.ts`：与基础译名不同的大陆动漫社区常用说法，运行时优先级更高。
- `data/tag-translation-review.csv`：标签复核记录，适合批量审阅。

社区修正表只保留真实改变译名的条目。提交标签修改时，建议附上 AniList 标签含义、常见中文用法或 Bangumi 条目作为依据。

### 作品标题

- `src/data/titles/overrides.ts`：少量人工修正，键是 AniList 作品 ID。
- `data/title-supplement.json`：由数据源合并生成，使用 `npm run merge-titles` 更新。

自动生成的标题补充库由脚本维护，日常标题纠错请优先添加人工修正。

### 人物与角色名称

`src/data/entities/overrides.ts` 只保存少量已确认纠错，键为 AniList 角色或人物 ID。提交时请附 AniList 链接和可核验的简体中文译名来源。人物覆盖主要由运行时 Wikidata 与 Bangumi 查询完成，不以人工扩充完整词典为目标。

## 翻译原则

采用中国大陆动画、漫画社区自然常用的简体中文表达，结合页面语境确定译名；专有名词优先沿用稳定译法，避免逐词直译。详细说明见 [翻译规范](docs/translation-guide.md)。

## 本地检查

首次参与先安装依赖：

```bash
npm install
```

修改后运行：

```bash
npm run check
```

该命令会依次运行测试、类型检查、词典检查、脚本构建和覆盖率检查。若只修改词典，可先运行 `npm run check:dictionary` 快速定位问题。

## 提交建议

- 一个 Pull Request 聚焦一个页面、一个词典批次或一个问题。
- 漏译和样式问题请提供 AniList 页面链接及截图。
- 保留英文键的大小写、空格和标点，使其与页面原文精确一致。
- 不提交 `node_modules/`、`.DS_Store` 或 `outputs/` 中的本地审阅产物。
- 发布版本号和 `dist/` 更新由维护者在合并时统一处理。
