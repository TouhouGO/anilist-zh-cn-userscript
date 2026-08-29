# 社区维护与仓库整理设计

## 目标

在保持现有用户脚本功能和一键安装地址稳定的前提下，把词典、生成数据、贡献文档和 GitHub 协作入口整理成容易理解、容易审阅、容易扩展的社区项目。

## 采用方案

采用适度社区化结构：不引入在线翻译后台，也不改变脚本运行架构；把人工维护内容按职责拆分，并为词典增加自动校验和明确的贡献说明。

## 词典与数据结构

- `src/data/ui/`：按页面保存人工维护的界面词典，每个文件只负责一个页面域。
- `src/data/tags/`：保存 AniList 英文标签到简体中文的基础词典与大陆社区语境优先修正。
- `src/data/titles/`：保存少量人工标题修正。
- `src/data/ui-zh-CN.ts`、`src/data/tag-zh-CN.ts`、`src/data/tag-bangumi-zh-CN.ts`、`src/data/title-overrides.ts`：保留为稳定聚合入口，减少业务代码改动。
- `data/title-supplement.json`：自动生成的标题补充库，不接受逐行人工编辑。
- `data/tag-translation-review.csv`：标签审阅的可维护源文件。
- `outputs/`：本地生成的审阅产物，不进入版本库。

词典键始终保留 AniList 页面原文，值使用中国大陆动画、漫画社区常用说法。人工修正优先于基础翻译；自动生成数据不得覆盖人工修正。

## 自动校验

新增词典校验命令，至少检查：

- 英文键和中文值均为非空文本；
- 每个词典文件内部没有重复键；
- 标签基础词典与社区修正词典允许同键覆盖，但修正项必须真实改变译名；
- 标题修正键必须是正整数 AniList ID；
- UI 聚合入口包含脚本支持的全部页面域。

校验加入统一的 `npm run check`，与测试、类型检查、构建和覆盖率检查一起执行。

## 社区文档

- README：项目定位、一键安装、功能范围、当前阶段、维护目录、贡献入口、开发命令、数据来源和许可证。
- CONTRIBUTING：分别说明添加界面文案、标签译名、标题修正的最短流程，以及提交前检查。
- `docs/translation-guide.md`：简短记录大陆简体中文用语、语境优先、专有名词和敏感标签的翻译原则。
- `docs/data-sources.md`：说明各数据源用途、优先级和许可证。
- GitHub Issue/PR 模板：分别收集漏译、错译、页面兼容问题和功能建议。

## 许可证与署名

项目自有代码采用 MIT 许可证。引用和派生数据继续遵守上游条款并保留来源：`soruly/anilist-chinese` 为 MIT，`bangumi-data/bangumi-data` 数据为 CC BY 4.0，`nz3u/bangumi-data` 为 GPL-3.0，`opencc-js` 为 MIT。仅在实际使用对应内容的范围内声明其来源和条款。

## Git 身份与历史整理

GitHub 页面出现 `Jensen Yang`，是因为现有提交作者为 `Jensen Yang <na@Na-MacBook-Pro.local>`；该本地邮箱也没有关联 GitHub 账户，所以 Contributors 没有归属到当前登录的 `TouhouGO`。

实施时将仓库本地 Git 身份设为：

- 名称：`TouhouGO`
- 邮箱：`93237754+TouhouGO@users.noreply.github.com`

全部整理和验证完成后，先建立只保存在本机的历史备份引用，再创建一个无父提交的新根提交，作者和提交者均为 `TouhouGO`，最后用 `--force-with-lease` 更新远端 `main`。远端最终只保留这一个项目提交，旧的 `Jensen Yang` 提交不再出现在主分支历史中。

## 验收标准

- 用户脚本行为、一键安装地址和构建产物保持正常。
- 词典按页面和类别可快速定位，新增词条有清晰入口。
- `npm run check` 全部通过。
- README 和贡献文档足以让首次参与者完成一次翻译修正。
- GitHub `main` 只有一个由 `TouhouGO` 署名的根提交。
