# 社区维护与仓库整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AniList 简体中文用户脚本整理为词典边界清楚、贡献流程明确、自动校验完整且由 TouhouGO 单提交发布的社区项目。

**Architecture:** 保留现有业务模块和聚合导出接口，把人工词典按 UI、标签、标题三个领域拆分。生成数据继续由脚本生产，人工数据通过 Vitest 校验；README、贡献指南和 GitHub 模板共同构成社区入口。验证完成后重写 Git 历史为单一根提交。

**Tech Stack:** TypeScript、Vite、Vitest、Node.js、用户脚本、GitHub

**Spec:** `docs/superpowers/specs/2026-08-29-community-maintenance-design.md`

## Global Constraints

- 保持 `dist/anilist-zh-cn.user.js` 一键安装地址不变。
- 保持现有翻译行为、标题数据优先级和运行时接口兼容。
- 英文键必须精确对应 AniList 页面原文，中文值采用中国大陆动画、漫画社区常用表达。
- 项目自有代码使用 MIT；第三方数据保留各自来源和许可说明。
- 远端 `main` 最终仅保留一个作者和提交者均为 `TouhouGO` 的根提交。

---

### Task 1: 拆分人工词典并保留聚合接口

**Files:**
- Create: `src/data/ui/global.ts`
- Create: `src/data/ui/home.ts`
- Create: `src/data/ui/search.ts`
- Create: `src/data/ui/media.ts`
- Create: `src/data/ui/list.ts`
- Create: `src/data/ui/profile.ts`
- Create: `src/data/ui/forum.ts`
- Create: `src/data/ui/notifications.ts`
- Create: `src/data/ui/settings.ts`
- Create: `src/data/ui/index.ts`
- Create: `src/data/tags/base.ts`
- Create: `src/data/tags/community.ts`
- Create: `src/data/tags/index.ts`
- Create: `src/data/titles/overrides.ts`
- Modify: `src/data/ui-zh-CN.ts`
- Modify: `src/data/tag-zh-CN.ts`
- Modify: `src/data/tag-bangumi-zh-CN.ts`
- Modify: `src/data/title-overrides.ts`
- Test: `src/data/ui-zh-CN.test.ts`
- Test: `src/data/dictionary-structure.test.ts`

**Interfaces:**
- Consumes: existing `UiDictionary = Record<string, string>` from `src/types.ts`.
- Produces: unchanged exports `uiZhCN`, `globalUiZhCN`, `tagZhCN`, `bangumiTagZhCN`, and `titleOverrides`.

- [ ] **Step 1: Write the failing structure test**

Create `src/data/dictionary-structure.test.ts` that imports the new domain indexes and asserts the exact UI section keys, representative tag translations, and positive numeric title IDs.

- [ ] **Step 2: Run the focused test and confirm the new modules are missing**

Run: `npm test -- src/data/dictionary-structure.test.ts`

Expected: FAIL because `src/data/ui/index.ts`, `src/data/tags/index.ts`, and `src/data/titles/overrides.ts` do not exist.

- [ ] **Step 3: Move each existing dictionary section into its responsibility file**

Each UI file exports one `UiDictionary`; `src/data/ui/index.ts` exports:

```ts
export const uiZhCN: Record<string, UiDictionary> = {
  global: globalUi,
  home: homeUi,
  search: searchUi,
  media: mediaUi,
  list: listUi,
  profile: profileUi,
  forum: forumUi,
  notifications: notificationsUi,
  settings: settingsUi,
};
```

Move current tag objects without changing keys or values. Make the four legacy files re-export from the new locations.

- [ ] **Step 4: Run dictionary and existing translation tests**

Run: `npm test -- src/data/dictionary-structure.test.ts src/data/ui-zh-CN.test.ts src/translator.test.ts`

Expected: PASS with unchanged public exports and translations.

- [ ] **Step 5: Commit the independently working dictionary split**

Run: `git add src/data && git commit -m "重整可维护词典目录"`

### Task 2: 增加词典质量校验和统一检查命令

**Files:**
- Create: `scripts/dictionary-rules.ts`
- Create: `scripts/dictionary-rules.test.ts`
- Create: `scripts/check-dictionaries.ts`
- Modify: `scripts/check-coverage.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `uiZhCN`, `tagZhCN`, `bangumiTagZhCN`, `titleOverrides`.
- Produces: `validateDictionaryData(): string[]`; commands `npm run check:dictionary`, `npm run typecheck`, and `npm run check`.

- [ ] **Step 1: Write failing rule tests**

Test empty keys, empty values, non-positive title IDs, unchanged community overrides, and a valid fixture. Expected return type is an array of human-readable errors.

- [ ] **Step 2: Run the focused tests and confirm the validator is missing**

Run: `npm test -- scripts/dictionary-rules.test.ts`

Expected: FAIL because `validateDictionaryData` is not defined.

- [ ] **Step 3: Implement pure validation rules and the CLI wrapper**

`validateDictionaryData` receives explicit dictionaries so tests use small fixtures. `check-dictionaries.ts` imports production dictionaries, prints every error, and sets `process.exitCode = 1` when errors exist.

- [ ] **Step 4: Add package scripts**

Add:

```json
"typecheck": "tsc --noEmit",
"check:dictionary": "tsx scripts/check-dictionaries.ts",
"check": "npm test && npm run typecheck && npm run check:dictionary && npm run build && npm run coverage"
```

- [ ] **Step 5: Run focused and production checks**

Run: `npm test -- scripts/dictionary-rules.test.ts && npm run typecheck && npm run check:dictionary`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the validation layer**

Run: `git add package.json package-lock.json scripts && git commit -m "增加词典质量校验"`

### Task 3: 整理生成数据和审阅产物

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/merge-title-sources.mjs`
- Delete: `outputs/anilist-tag-translation-review-v1.xlsx`
- Keep: `data/title-supplement.json`
- Keep: `data/tag-translation-review.csv`

**Interfaces:**
- Consumes: upstream Bangumi Data and AniList Chinese endpoints.
- Produces: deterministic `data/title-supplement.json` with source metadata; local untracked `outputs/` artifacts.

- [ ] **Step 1: Add generated-artifact ignore rules**

Ignore `outputs/` while retaining the review CSV and built userscript tracked in Git.

- [ ] **Step 2: Make title generation metadata stable and explicit**

Keep entries sorted by numeric AniList ID; add a top-level `schemaVersion: 1`; preserve `generatedAt`, `sources`, and current merge priority.

- [ ] **Step 3: Regenerate and inspect the title supplement**

Run: `npm run merge-titles`

Expected: exit 0, valid JSON, ascending unique IDs, and `schemaVersion` equals `1`.

- [ ] **Step 4: Commit data housekeeping**

Run: `git add .gitignore scripts/merge-title-sources.mjs data/title-supplement.json && git add -u outputs && git commit -m "区分人工词典与生成数据"`

### Task 4: 建立社区文档和 GitHub 协作入口

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `docs/translation-guide.md`
- Create: `docs/data-sources.md`
- Create: `.github/ISSUE_TEMPLATE/translation.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/pull_request_template.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: new dictionary paths and package scripts from Tasks 1–3.
- Produces: public installation, maintenance, attribution, issue, and pull-request guidance.

- [ ] **Step 1: Write the MIT license and concise translation/data-source documents**

Credit `soruly/anilist-chinese` (MIT), `bangumi-data/bangumi-data` (CC BY 4.0), `nz3u/bangumi-data` (GPL-3.0), and `opencc-js` (MIT), describing only how this project uses each source.

- [ ] **Step 2: Write CONTRIBUTING with three direct contribution paths**

Document exact files for UI text, tag translation, and title overrides; require `npm install` once and `npm run check` before a pull request.

- [ ] **Step 3: Add structured Issue forms and PR checklist**

Translation reports must request AniList URL, page area, original text, suggested mainland-Chinese wording, and screenshot. Bug reports request script version, browser, manager, URL, reproduction, and screenshot.

- [ ] **Step 4: Rewrite README as the public project landing page**

Keep the raw one-click install link. Add project positioning, feature/status table, maintainable directory map, contribution entry, command explanations, privacy/network behavior, data sources, license, and current limitations.

- [ ] **Step 5: Check all referenced paths and links**

Run: `rg -n "src/data|data/|docs/|https://" README.md CONTRIBUTING.md docs .github`

Expected: every local path exists and every upstream repository uses its canonical GitHub URL.

- [ ] **Step 6: Commit community documentation**

Run: `git add README.md CONTRIBUTING.md LICENSE docs .github && git commit -m "完善社区维护与贡献说明"`

### Task 5: 全量验证和构建发布文件

**Files:**
- Modify: `dist/anilist-zh-cn.user.js`

**Interfaces:**
- Consumes: all source dictionaries, tests, documentation-linked commands, and build configuration.
- Produces: verified installable userscript at the unchanged path.

- [ ] **Step 1: Run the unified check**

Run: `npm run check`

Expected: Vitest, TypeScript, dictionary validation, Vite build, and coverage all exit 0.

- [ ] **Step 2: Verify the built userscript metadata and repository cleanliness**

Run: `head -30 dist/anilist-zh-cn.user.js && git diff --check && git status --short`

Expected: metadata contains the GitHub install/update URLs; `git diff --check` has no output; only intended generated changes remain.

- [ ] **Step 3: Commit the regenerated userscript if changed**

Run: `git add dist/anilist-zh-cn.user.js && git commit -m "构建社区维护版本"`

### Task 6: 修正 Git 身份并发布单一根提交

**Files:**
- Modify: repository-local Git configuration only.
- Rewrite: Git history for `main`.

**Interfaces:**
- Consumes: fully verified working tree and remote `origin/main` object ID.
- Produces: one root commit on local and remote `main`, authored and committed by TouhouGO.

- [ ] **Step 1: Record remote state and create a local rollback reference**

Run: `git fetch origin main && git branch backup/pre-community-rewrite origin/main`

Expected: local backup branch points at the previous remote tip and is not pushed.

- [ ] **Step 2: Configure repository-local Git identity**

Run:

```bash
git config user.name TouhouGO
git config user.email 93237754+TouhouGO@users.noreply.github.com
```

- [ ] **Step 3: Create the single root commit from the verified tree**

Use a temporary orphan branch, stage the full tree, create commit message `发布 AniList 简体中文用户脚本`, and rename it to `main`. Set both author and committer through the repository-local identity.

- [ ] **Step 4: Verify the rewritten identity and commit count**

Run: `git rev-list --count main && git log -1 --format='%an <%ae>%n%cn <%ce>%n%P%n%s'`

Expected: count `1`; author and committer are `TouhouGO <93237754+TouhouGO@users.noreply.github.com>`; parent line is empty.

- [ ] **Step 5: Update remote main with lease protection**

Run: `git push --force-with-lease origin main`

Expected: remote `main` advances to the new root commit.

- [ ] **Step 6: Verify GitHub state from the API**

Run: `gh api repos/TouhouGO/anilist-zh-cn-userscript/commits/main --jq '{sha:.sha,author:.commit.author,login:.author.login,parents:(.parents|length)}'`

Expected: `login` is `TouhouGO`, author name is `TouhouGO`, and parent count is `0`.

- [ ] **Step 7: Verify the published userscript**

Open the raw install URL and confirm its metadata/version matches local `dist/anilist-zh-cn.user.js`.
