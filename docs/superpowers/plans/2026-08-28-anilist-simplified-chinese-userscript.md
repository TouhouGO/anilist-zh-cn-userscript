# AniList 简体中文用户脚本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可安装的 Tampermonkey/Violentmonkey 用户脚本，将 AniList 全部界面控件、状态文案和作品标题显示为简体中文。

**Architecture:** 独立 TypeScript 脚本以路由层和增量 DOM 观察器驱动，词典规则按页面模块拆分。UI 词典负责精确/模板替换，标题服务负责缓存公开中文标题数据并通过 OpenCC 转为简体，排除规则保护用户生成内容。

**Tech Stack:** TypeScript, Vite, Vitest, opencc-js, Tampermonkey/Violentmonkey userscript metadata.

**Spec:** `docs/superpowers/specs/2026-08-28-anilist-simplified-chinese-userscript-design.md`

## Global Constraints

- 仅匹配 `https://anilist.co/*`。
- 只翻译界面控件、状态文案和作品标题；不翻译用户或内容正文。
- 所有替换必须幂等并兼容 AniList SPA 无刷新路由和异步渲染。
- 标题数据缓存 24 小时；网络失败时使用缓存或内置快照。
- 构建产物必须是单个可直接安装的 userscript 文件。

---

### Task 1: 项目脚手架与词典类型

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/types.ts`
- Create: `src/data/ui-zh-CN.ts`
- Create: `src/data/title-overrides.ts`
- Test: `src/data/ui-zh-CN.test.ts`

**Interfaces:**
- Produces `TranslationRule`, `TemplateRule`, `UiDictionary` types and the initial dictionary registry consumed by later tasks.

- [ ] **Step 1: Write the failing tests** for exact matching entries, parameter placeholders and protected-region metadata.
- [ ] **Step 2: Run `npm test -- src/data/ui-zh-CN.test.ts`** and verify the missing modules fail.
- [ ] **Step 3: Implement package/build config and typed dictionary modules** with representative global, home, search, media, list, profile, forum, notification and settings entries.
- [ ] **Step 4: Run the focused test and verify it passes.**
- [ ] **Step 5: Commit** with `git add package.json tsconfig.json vite.config.ts src && git commit -m "feat: scaffold typed AniList Chinese dictionaries"`.

### Task 2: 路由识别与增量 DOM 观察

**Files:**
- Create: `src/router.ts`
- Create: `src/observer.ts`
- Test: `src/router.test.ts`
- Test: `src/observer.test.ts`

**Interfaces:**
- `parseRoute(url: string): { section: string; type?: 'anime'|'manga'; id?: number }`.
- `startRouteObserver(onRoute: (route, previous) => void): () => void`.
- `startDomObserver(onNodes: (nodes: Element[]) => void): () => void`.

- [ ] **Step 1: Write failing tests** for AniList route parsing, History API changes, deduplication, and added-node batching.
- [ ] **Step 2: Run focused Vitest tests and verify failure.**
- [ ] **Step 3: Implement route wrappers and a debounced `MutationObserver`** that reports only element roots and disconnects cleanly.
- [ ] **Step 4: Run focused tests and verify pass.**
- [ ] **Step 5: Commit** with `git add src/router.ts src/observer.ts src/*.test.ts && git commit -m "feat: observe AniList SPA routes and DOM updates"`.

### Task 3: UI 翻译引擎与排除规则

**Files:**
- Create: `src/translator.ts`
- Create: `src/selectors.ts`
- Test: `src/translator.test.ts`

**Interfaces:**
- `translateRoot(root: Element, route: Route): number`.
- `translateText(value: string, context: TranslationContext): string`.
- `isProtected(element: Element): boolean`.

- [ ] **Step 1: Write failing tests** for exact text, whitespace preservation, template interpolation, attributes, idempotence, and protected content selectors.
- [ ] **Step 2: Run tests and verify failure.**
- [ ] **Step 3: Implement TreeWalker-based text handling** limited to approved UI roots, attribute translation for `placeholder`, `title`, `aria-label`, and a `data-anilist-cn-original` marker.
- [ ] **Step 4: Add route-specific selector maps** and explicit exclusions for descriptions, comments, activity bodies, forum bodies, usernames, character names and staff names.
- [ ] **Step 5: Run tests and verify pass.**
- [ ] **Step 6: Commit** with `git add src/translator.ts src/selectors.ts src/translator.test.ts && git commit -m "feat: translate AniList UI text incrementally"`.

### Task 4: 标题数据服务

**Files:**
- Create: `src/title-service.ts`
- Create: `src/data/title-snapshot.ts`
- Test: `src/title-service.test.ts`
- Modify: `package.json`

**Interfaces:**
- `TitleService.getTitle(id: number, fallback: string): string`.
- `TitleService.refresh(): Promise<void>`.
- `createTitleService(storage: StorageLike, fetcher: FetchLike): TitleService`.

- [ ] **Step 1: Write failing tests** for override precedence, cache hit, 24-hour expiry, malformed payload, network failure, and fallback behavior.
- [ ] **Step 2: Run tests and verify failure.**
- [ ] **Step 3: Implement JSON loading from the pinned `anilist-chinese` raw data URL**, local cache validation, deterministic t2s conversion through `opencc-js`, and manual overrides.
- [ ] **Step 4: Run tests and verify pass.**
- [ ] **Step 5: Commit** with `git add src/title-service.ts src/data/title-snapshot.ts src/title-service.test.ts package.json && git commit -m "feat: add cached simplified Chinese title service"`.

### Task 5: 标题替换、入口与诊断

**Files:**
- Create: `src/title-translator.ts`
- Create: `src/diagnostics.ts`
- Create: `src/main.ts`
- Create: `src/userscript.d.ts`
- Test: `src/title-translator.test.ts`

**Interfaces:**
- `translateTitles(root: Element, service: TitleService): number`.
- `createDiagnostics(enabled: boolean): Diagnostics`.
- `boot(): void`.

- [ ] **Step 1: Write failing tests** for anime/manga ID extraction, title-node replacement, duplicate prevention, cache fallback and diagnostics opt-in.
- [ ] **Step 2: Run tests and verify failure.**
- [ ] **Step 3: Implement title traversal** for links/cards/headings, preserving original href and non-title children, then wire route and DOM observers in `boot()`.
- [ ] **Step 4: Add a Tampermonkey menu command** to toggle diagnostics and log only unmatched UI candidates.
- [ ] **Step 5: Run all tests and verify pass.**
- [ ] **Step 6: Commit** with `git add src && git commit -m "feat: wire AniList Chinese userscript runtime"`.

### Task 6: 构建、覆盖检查与安装文档

**Files:**
- Modify: `vite.config.ts`
- Create: `scripts/check-coverage.ts`
- Create: `tests/fixtures/routes.json`
- Create: `README.md`
- Create: `dist/anilist-zh-cn.user.js` via build

- [ ] **Step 1: Add build metadata** (`@name`, `@match`, `@grant`, `@updateURL`, `@downloadURL`) and external data URL configuration.
- [ ] **Step 2: Implement coverage checker** that validates every route module has dictionary/selectors and reports known English UI fixture misses.
- [ ] **Step 3: Run `npm test`, `npm run build`, and `npm run coverage`**, expecting all tests pass and a single userscript artifact is produced.
- [ ] **Step 4: Review output size and confirm no source maps or secrets are bundled.**
- [ ] **Step 5: Write README installation and troubleshooting instructions** for Tampermonkey and Violentmonkey.
- [ ] **Step 6: Commit** with `git add vite.config.ts scripts tests README.md dist && git commit -m "docs: package and verify AniList Chinese userscript"`.
