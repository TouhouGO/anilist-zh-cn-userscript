# AniList 人物与角色名称汉化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不上传用户数据、不打包完整人物库的前提下，为 AniList 角色、声优和制作人员显示简体中文名称。

**Architecture:** 专用 DOM 翻译器从 `/character/{id}` 与 `/staff/{id}` 链接提取 AniList ID，批量交给名称服务。名称服务依次使用本地纠错、Wikidata 直接 ID、Bangumi 同作品原名唯一匹配，并将正负结果保存在浏览器本地缓存中；路由代号隔离迟到响应。

**Tech Stack:** TypeScript、Vitest、Vite、opencc-js、AniList GraphQL、Wikidata SPARQL、Bangumi API、用户脚本 `GM_xmlhttpRequest`

**Spec:** `docs/superpowers/specs/2026-08-29-entity-name-localization-design.md`

## Global Constraints

- 以单人长期使用为前提，不依赖社区持续维护。
- 第一版只替换角色、声优和制作人员名称，不处理简介、经历和关系说明。
- 不加入完整人物数据库，不增加运行时依赖。
- 数据优先级固定为：本地纠错 > Wikidata 直接 AniList ID > Bangumi 同作品唯一原名匹配 > AniList 原名。
- 有效结果缓存 30 天，未命中结果缓存 7 天，缓存仅存在当前浏览器。
- 不加入遥测、中心服务、用户数据上传或后台遍历。
- Bangumi 详情请求并发上限为 2；页面切换后忽略旧路由响应。
- 外部数据异常、结果无汉字或匹配有歧义时保持 AniList 原名。
- 首版版本号为 `0.1.14`，只在 `codex/entity-localization-v1` 分支开发，不推送或改动 `main`。

---

### Task 1: 提取共享中文归一化工具

**Files:**
- Create: `src/chinese-normalizer.ts`
- Create: `src/chinese-normalizer.test.ts`
- Modify: `src/title-service.ts`

**Interfaces:**
- Produces: `toMainlandChinese(value: string): string`
- Produces: `normalizeEntityNativeName(value: string): string`
- Consumes: `opencc-js` 已有依赖

- [ ] **Step 1: 写入失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeEntityNativeName, toMainlandChinese } from './chinese-normalizer';

describe('Chinese normalizer', () => {
  it('converts traditional Chinese and mainland terminology', () => {
    expect(toMainlandChinese('動畫與聲優')).toBe('动画与声优');
  });

  it('normalizes native names without changing Japanese characters', () => {
    expect(normalizeEntityNativeName(' 斎藤・千和 ')).toBe('斎藤千和');
  });
});
```

- [ ] **Step 2: 验证测试先失败**

Run: `npx vitest run src/chinese-normalizer.test.ts`

Expected: FAIL，提示 `./chinese-normalizer` 模块不存在。

- [ ] **Step 3: 实现最小共享工具并迁移标题服务**

```ts
import OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 't', to: 'cn' });
const mainlandTerms: Array<[string, string]> = [
  ['動畫', '动画'], ['漫畫', '漫画'], ['聲優', '声优'], ['劇場版', '剧场版'],
  ['特別篇', '特别篇'], ['電視', '电视'], ['與', '与'], ['為', '为'],
];

export function toMainlandChinese(value: string): string {
  let result = converter(value);
  for (const [from, to] of mainlandTerms) result = result.replaceAll(from, to);
  return result;
}

export function normalizeEntityNativeName(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}
```

删除 `src/title-service.ts` 内部的 OpenCC 实例和重复词表，改为导入 `toMainlandChinese`；保持现有标题搜索归一化行为。

- [ ] **Step 4: 运行归一化与标题测试**

Run: `npx vitest run src/chinese-normalizer.test.ts src/title-service.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/chinese-normalizer.ts src/chinese-normalizer.test.ts src/title-service.ts
git commit -m "refactor: 共享中文名称归一化"
```

### Task 2: 实现 Wikidata 直接 ID 数据源

**Files:**
- Create: `src/entity-name-types.ts`
- Create: `src/json-request.ts`
- Create: `src/wikidata-name-source.ts`
- Create: `src/wikidata-name-source.test.ts`
- Modify: `src/userscript.d.ts`

**Interfaces:**
- Produces: `EntityKind = 'character' | 'staff'`
- Produces: `EntityRef = { kind: EntityKind; id: number }`
- Produces: `JsonRequester = (url: string, init?: JsonRequestInit) => Promise<unknown>`
- Produces: `requestJson(url, init?): Promise<unknown>`，浏览器中优先使用 `GM_xmlhttpRequest`
- Produces: `createWikidataNameSource(requester?).load(kind, ids): Promise<Map<number, string>>`
- Consumes: `toMainlandChinese(value)` from Task 1

- [ ] **Step 1: 写入查询和解析失败测试**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createWikidataNameSource } from './wikidata-name-source';

describe('Wikidata entity names', () => {
  it('queries direct AniList character IDs and keeps only Han labels', async () => {
    const request = vi.fn(async () => ({ results: { bindings: [
      { anilistId: { value: '1' }, itemLabel: { value: '史派克·斯皮格尔' } },
      { anilistId: { value: '2' }, itemLabel: { value: 'Faye Valentine' } },
    ] } }));
    const result = await createWikidataNameSource(request).load('character', [1, 2]);
    expect(decodeURIComponent(new URL(request.mock.calls[0][0]).searchParams.get('query') || '')).toContain('wdt:P11736');
    expect(result).toEqual(new Map([[1, '史派克·斯皮格尔']]));
  });

  it('uses the AniList staff property and ignores unrequested IDs', async () => {
    const request = vi.fn(async () => ({ results: { bindings: [
      { anilistId: { value: '95011' }, itemLabel: { value: '山寺宏一' } },
      { anilistId: { value: '99999' }, itemLabel: { value: '其他人物' } },
    ] } }));
    const result = await createWikidataNameSource(request).load('staff', [95011]);
    expect(decodeURIComponent(new URL(request.mock.calls[0][0]).searchParams.get('query') || '')).toContain('wdt:P11227');
    expect(result).toEqual(new Map([[95011, '山寺宏一']]));
  });
});
```

- [ ] **Step 2: 验证测试先失败**

Run: `npx vitest run src/wikidata-name-source.test.ts`

Expected: FAIL，提示数据源模块不存在。

- [ ] **Step 3: 定义数据类型与通用 JSON 请求器**

```ts
export type EntityKind = 'character' | 'staff';
export type EntityRef = { kind: EntityKind; id: number };
export type EntityNameMap = Map<number, string>;
export type JsonRequestInit = { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string };
export type JsonRequester = (url: string, init?: JsonRequestInit) => Promise<unknown>;
```

`requestJson` 在 `GM_xmlhttpRequest` 存在时解析 `responseText`，否则调用 `fetch`；非 2xx、JSON 解析异常及网络错误统一 reject，由上层降级。

- [ ] **Step 4: 实现 Wikidata 批量查询与严格过滤**

```ts
const properties = { character: 'P11736', staff: 'P11227' } as const;
const hasHan = (value: string) => /[\p{Script=Han}]/u.test(value);

export function createWikidataNameSource(requester: JsonRequester = requestJson) {
  return { async load(kind: EntityKind, ids: number[]): Promise<EntityNameMap> {
    const requested = new Set(ids.filter(Number.isInteger));
    if (!requested.size) return new Map();
    const values = [...requested].map(id => `"${id}"`).join(' ');
    const query = `SELECT ?anilistId ?itemLabel WHERE {
      VALUES ?anilistId { ${values} }
      ?item wdt:${properties[kind]} ?anilistId.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-cn,zh-hans,zh". }
    }`;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const payload = await requester(url) as WikidataPayload;
    const result = new Map<number, string>();
    for (const row of payload.results?.bindings || []) {
      const id = Number(row.anilistId?.value);
      const label = toMainlandChinese(row.itemLabel?.value?.trim() || '');
      if (requested.has(id) && hasHan(label)) result.set(id, label);
    }
    return result;
  } };
}
```

实际实现补充 `WikidataPayload` 类型，并在 `src/userscript.d.ts` 中把 `GM_xmlhttpRequest` 声明扩展为支持 headers/body。

- [ ] **Step 5: 运行数据源测试和类型检查**

Run: `npx vitest run src/wikidata-name-source.test.ts && npm run typecheck`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/entity-name-types.ts src/json-request.ts src/wikidata-name-source.ts src/wikidata-name-source.test.ts src/userscript.d.ts
git commit -m "feat: 添加 Wikidata 人物名称数据源"
```

### Task 3: 实现 Bangumi 同作品精确补全

**Files:**
- Create: `src/bangumi-entity-source.ts`
- Create: `src/bangumi-entity-source.test.ts`
- Consume: `data/title-supplement.json`

**Interfaces:**
- Produces: `EntityMediaContext = { mediaId: number; mediaType: 'ANIME' | 'MANGA' }`
- Produces: `createBangumiEntitySource(requester?).load(context, kind, ids): Promise<Map<number, string>>`
- Consumes: `JsonRequester`, `EntityKind`, `normalizeEntityNativeName`, `toMainlandChinese`

- [ ] **Step 1: 写入唯一匹配与歧义失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { createBangumiEntitySource } from './bangumi-entity-source';

describe('Bangumi entity fallback', () => {
  it('maps a character only through a unique native-name match', async () => {
    const request = async (url: string) => {
      if (url === 'https://graphql.anilist.co') return { data: { Page: { characters: [{ id: 1, name: { native: 'スパイク・スピーゲル' } }] } } };
      if (url.endsWith('/subjects/253/characters')) return [{ id: 77, name: 'スパイク・スピーゲル', actors: [] }];
      if (url.endsWith('/characters/77')) return { infobox: [{ key: '简体中文名', value: '史派克·斯皮格尔' }] };
      throw new Error(url);
    };
    const source = createBangumiEntitySource(request);
    await expect(source.load({ mediaId: 1, mediaType: 'ANIME' }, 'character', [1]))
      .resolves.toEqual(new Map([[1, '史派克·斯皮格尔']]));
  });

  it('rejects duplicate native-name candidates', async () => {
    const request = async (url: string) => {
      if (url === 'https://graphql.anilist.co') return { data: { Page: { characters: [{ id: 1, name: { native: '同名' } }] } } };
      if (url.endsWith('/subjects/253/characters')) return [{ id: 7, name: '同名' }, { id: 8, name: '同名' }];
      throw new Error(`details must not be requested: ${url}`);
    };
    await expect(createBangumiEntitySource(request).load({ mediaId: 1, mediaType: 'ANIME' }, 'character', [1]))
      .resolves.toEqual(new Map());
  });
});
```

- [ ] **Step 2: 验证测试先失败**

Run: `npx vitest run src/bangumi-entity-source.test.ts`

Expected: FAIL，提示数据源模块不存在。

- [ ] **Step 3: 实现 AniList native name 批量读取**

对 `character` 使用 `Page.characters(id_in: $ids)`，对 `staff` 使用 `Page.staff(id_in: $ids)`；POST 到 `https://graphql.anilist.co`，请求体只包含公开实体 ID。响应转换为 `Map<AniList ID, native name>`。

```ts
const field = kind === 'character' ? 'characters' : 'staff';
const query = `query ($ids: [Int]) { Page(page: 1, perPage: 50) {
  ${field}(id_in: $ids) { id name { native } }
} }`;
```

- [ ] **Step 4: 实现 Bangumi 作品映射和候选收集**

从 `title-supplement.json` 建立 `AniList media ID -> Bangumi subject ID` 映射。角色读取 `/v0/subjects/{id}/characters`；人物读取 `/v0/subjects/{id}/persons` 并合并角色列表的 `actors`。候选项按 `normalizeEntityNativeName` 建索引，只有索引长度为 1 时继续。

- [ ] **Step 5: 实现详情名读取和并发 2 队列**

```ts
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

角色详情读取 `/v0/characters/{id}`，人物详情读取 `/v0/persons/{id}`。只接受 infobox 中键名严格等于 `简体中文名` 且值包含汉字的结果。

- [ ] **Step 6: 补充人物 actor 匹配和并发测试**

增加测试：`staff` 能从角色列表 `actors` 找到声优；同时发起 4 个详情请求时观测到的最大并发数为 2；某个详情失败时其他结果仍返回。

- [ ] **Step 7: 运行 Bangumi 数据源测试和类型检查**

Run: `npx vitest run src/bangumi-entity-source.test.ts && npm run typecheck`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add src/bangumi-entity-source.ts src/bangumi-entity-source.test.ts
git commit -m "feat: 添加 Bangumi 人物名称精确补全"
```

### Task 4: 实现本地缓存与数据源编排

**Files:**
- Create: `src/data/entities/overrides.ts`
- Create: `src/entity-name-service.ts`
- Create: `src/entity-name-service.test.ts`

**Interfaces:**
- Produces: `EntityNameOrigin = 'override' | 'wikidata' | 'bangumi'`
- Produces: `ResolvedEntityName = { kind: EntityKind; id: number; name: string; source: EntityNameOrigin }`
- Produces: `createEntityNameService(options?).resolve(refs, context?): Promise<Map<string, ResolvedEntityName>>`
- Produces: `entityKey(ref): '${kind}:${id}'`
- Consumes: Wikidata source from Task 2 and Bangumi source/context from Task 3

- [ ] **Step 1: 写入优先级与缓存失败测试**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createEntityNameService, entityKey } from './entity-name-service';

describe('Entity name service', () => {
  it('uses overrides, then Wikidata, then Bangumi', async () => {
    const wikidata = { load: vi.fn(async () => new Map([[2, '维基角色']])) };
    const bangumi = { load: vi.fn(async () => new Map([[3, '番组角色']])) };
    const service = createEntityNameService({
      storage: memoryStorage(), now: () => 1_000,
      overrides: { character: { 1: '人工角色' }, staff: {} }, wikidata, bangumi,
    });
    const result = await service.resolve([
      { kind: 'character', id: 1 }, { kind: 'character', id: 2 }, { kind: 'character', id: 3 },
    ], { mediaId: 1, mediaType: 'ANIME' });
    expect(result.get(entityKey({ kind: 'character', id: 1 }))?.name).toBe('人工角色');
    expect(result.get('character:2')?.source).toBe('wikidata');
    expect(result.get('character:3')?.source).toBe('bangumi');
  });

  it('keeps positive cache for 30 days and negative cache for 7 days', async () => {
    // 使用可变 now 和内存 Storage，分别跨越 30 天及 7 天边界后验证重新请求。
  });
});
```

缓存测试的完整实现使用测试文件内的 `memoryStorage(): StorageLike`，并断言：正缓存到期前数据源调用次数不增加；负缓存到期前不再次查询；越过期限后调用次数增加一次。

- [ ] **Step 2: 验证测试先失败**

Run: `npx vitest run src/entity-name-service.test.ts`

Expected: FAIL，提示名称服务模块不存在。

- [ ] **Step 3: 创建类型安全的本地纠错表**

```ts
import type { EntityKind } from '../../entity-name-types';

export const entityNameOverrides: Record<EntityKind, Record<number, string>> = {
  character: {},
  staff: {},
};
```

首版不预填未经验证的名称。

- [ ] **Step 4: 实现版本化缓存与优先级编排**

缓存键使用 `anilist-zh-cn-entity-name-cache-v1`，记录结构为：

```ts
type CacheEntry = {
  name: string | null;
  source: 'wikidata' | 'bangumi' | 'miss';
  expiresAt: number;
};
```

`resolve` 去重实体引用，先装载人工纠错和有效缓存；未命中按 kind 分组批量查询 Wikidata；剩余项在有 media context 时查询 Bangumi；最后写入 30 天正缓存或 7 天负缓存。每个来源异常单独捕获并继续降级。

- [ ] **Step 5: 完成缓存期限和异常降级测试**

增加测试：损坏 JSON 缓存被忽略；Wikidata reject 后仍调用 Bangumi；外部来源异常时返回空 Map 且不写负缓存，使下一次访问可以重试。

- [ ] **Step 6: 运行服务测试和类型检查**

Run: `npx vitest run src/entity-name-service.test.ts && npm run typecheck`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/data/entities/overrides.ts src/entity-name-service.ts src/entity-name-service.test.ts
git commit -m "feat: 编排人物名称来源与本地缓存"
```

### Task 5: 接入专用 DOM 翻译器并隔离路由响应

**Files:**
- Create: `src/entity-name-translator.ts`
- Create: `src/entity-name-translator.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `extractEntityRef(path: string): EntityRef | undefined`
- Produces: `createEntityNameTranslator(service).translate(root, context?): void`
- Produces: `createEntityNameTranslator(service).beginRoute(): void`
- Produces: `createEntityNameTranslator(service).flush(): Promise<number>`
- Consumes: `EntityNameService.resolve(refs, context?)`

- [ ] **Step 1: 写入 ID 解析、名称替换和迟到响应失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { applyEntityName, extractEntityRef } from './entity-name-translator';

describe('Entity name translator', () => {
  it('extracts character and staff IDs', () => {
    expect(extractEntityRef('/character/1/Spike-Spiegel')).toEqual({ kind: 'character', id: 1 });
    expect(extractEntityRef('/staff/95011/Kouichi-Yamadera')).toEqual({ kind: 'staff', id: 95011 });
    expect(extractEntityRef('/anime/1/Cowboy-Bebop')).toBeUndefined();
  });

  it('stores the original name and updates a reused target', () => {
    const target = { textContent: 'Spike Spiegel', dataset: {} } as unknown as HTMLElement;
    expect(applyEntityName(target, { kind: 'character', id: 1 }, '史派克·斯皮格尔')).toBe(true);
    expect(target.textContent).toBe('史派克·斯皮格尔');
    expect(target.dataset.anilistZhCnEntityOriginal).toBe('Spike Spiegel');
  });
});
```

增加异步测试：第一次 `flush()` 的 service Promise 尚未完成时调用 `beginRoute()`，旧 Promise resolve 后目标仍保持原文；第二路由的结果可正常写入。

- [ ] **Step 2: 验证测试先失败**

Run: `npx vitest run src/entity-name-translator.test.ts`

Expected: FAIL，提示翻译器模块不存在。

- [ ] **Step 3: 实现实体识别和安全名称目标选择**

扫描根元素自身及后代 `a[href*="/character/"], a[href*="/staff/"]`。名称目标优先选择 `.name`、`.title`、`[class*="name"]`，其次选择链接的直接非空文本节点；图片链接和没有独立名称文本的容器跳过。人物详情路径额外扫描 `h1`。

每个候选保存实体 key、原名和当前路由代号；节点被 AniList 复用为其他实体时先恢复原名再重新登记。

- [ ] **Step 4: 实现同一事件循环批处理与路由代号**

`translate` 只收集候选并安排一次微任务；`flush` 对队列去重后调用 service。写回前检查：路由代号未变化、目标仍连接文档、链接当前 ID 与登记 ID 一致。`beginRoute` 递增代号并清空待处理队列。

- [ ] **Step 5: 在主入口接入服务**

```ts
const entityService = createEntityNameService();
const entityTranslator = createEntityNameTranslator(entityService);

const entityContext = (route: Route): EntityMediaContext | undefined =>
  route.section === 'media' && route.id && route.type
    ? { mediaId: route.id, mediaType: route.type.toUpperCase() as 'ANIME' | 'MANGA' }
    : undefined;
```

在现有 `translate` 中调用 `entityTranslator.translate(root, entityContext(route))`；在 `onRoute` 开始时调用 `entityTranslator.beginRoute()`。现有 UI、标题、标签和中文搜索调用顺序保持不变。

- [ ] **Step 6: 完成 DOM 目标、节点复用和批处理测试**

使用现有轻量对象桩覆盖：图片链接被跳过；名称子节点被替换而职责文本不变；同一实体多次入队只调用一次服务；节点复用后使用新 ID 名称。

- [ ] **Step 7: 运行翻译器、入口相关测试和类型检查**

Run: `npx vitest run src/entity-name-translator.test.ts src/translator.test.ts src/title-translator.test.ts src/observer.test.ts src/router.test.ts && npm run typecheck`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add src/entity-name-translator.ts src/entity-name-translator.test.ts src/main.ts
git commit -m "feat: 接入人物与角色名称汉化"
```

### Task 6: 更新用户脚本权限、版本与维护说明

**Files:**
- Modify: `scripts/userscript-metadata.ts`
- Modify: `scripts/userscript-metadata.test.ts`
- Modify: `README.md`
- Modify: `docs/data-sources.md`
- Modify: `CONTRIBUTING.md`
- Generated: `dist/anilist-zh-cn.user.js`

**Interfaces:**
- Produces: userscript version `0.1.14`
- Produces: `@connect query.wikidata.org`
- Documents: 人物名称数据优先级、缓存期限、无遥测与单人零维护边界

- [ ] **Step 1: 先更新元数据测试**

```ts
expect(userscriptVersion).toBe('0.1.14');
expect(userscriptMetadata).toContain('// @connect      query.wikidata.org');
expect(result).toContain('// @version      0.1.14');
```

- [ ] **Step 2: 验证元数据测试先失败**

Run: `npx vitest run scripts/userscript-metadata.test.ts`

Expected: FAIL，当前版本仍为 `0.1.13` 且缺少 Wikidata connect。

- [ ] **Step 3: 更新元数据与 README**

将 `userscriptVersion` 改为 `0.1.14`，在 `api.bgm.tv` 前后保持现有权限并新增 `query.wikidata.org`。README 的当前覆盖范围增加“角色、声优与制作人员名称（Wikidata 主查询，Bangumi 精确补全）”，并用一段话说明查询结果只存本地、无遥测、无用户数据上传。

- [ ] **Step 4: 更新数据源与贡献说明**

`docs/data-sources.md` 记录 Wikidata P11736/P11227、Bangumi 角色/人物接口、优先级和缓存周期。`CONTRIBUTING.md` 说明 `src/data/entities/overrides.ts` 只接收带 AniList ID 和可核验来源的少量纠错，不以人工扩充覆盖率为目标。

- [ ] **Step 5: 运行完整验证**

Run: `npm run check`

Expected: 所有 Vitest 测试、TypeScript 检查、词典检查、Vite 构建与覆盖检查均退出 0，并生成包含版本 `0.1.14` 与 Wikidata connect 的 `dist/anilist-zh-cn.user.js`。

- [ ] **Step 6: 检查构建产物和工作区差异**

Run: `rg -n '@version|@connect' dist/anilist-zh-cn.user.js | sed -n '1,12p' && git diff --check && git status --short`

Expected: 产物显示 `0.1.14`、`api.bgm.tv`、`graphql.anilist.co`、`query.wikidata.org`；`git diff --check` 无输出；状态只包含本计划内文件。

- [ ] **Step 7: 提交首版实现**

```bash
git add README.md CONTRIBUTING.md docs/data-sources.md scripts/userscript-metadata.ts scripts/userscript-metadata.test.ts dist/anilist-zh-cn.user.js
git commit -m "release: 完成人物与角色名称汉化首版"
```

### Task 7: 首版回归审查与回滚确认

**Files:**
- Review: all changes between `main` and `codex/entity-localization-v1`

**Interfaces:**
- Consumes: Tasks 1-6 completed branch
- Produces: verified branch ready for manual ScriptCat testing; no main merge or remote publication

- [ ] **Step 1: 运行最终验证并保存结果**

Run: `npm run check && git diff --check main...HEAD`

Expected: 全部退出 0。

- [ ] **Step 2: 审查范围和隐私边界**

Run: `git diff --stat main...HEAD && rg -n 'telemetry|analytics|username|search history|浏览历史|用户数据' src scripts README.md docs CONTRIBUTING.md`

Expected: 差异仅覆盖本计划；源码中没有遥测或上传实现，文档明确隐私边界。

- [ ] **Step 3: 确认稳定版仍可回退**

Run: `git rev-parse main && git rev-parse origin/main && git branch --show-current`

Expected: `main` 与 `origin/main` 仍指向同一个稳定提交；当前分支为 `codex/entity-localization-v1`。

- [ ] **Step 4: 提供本地测试入口**

打开 `dist/anilist-zh-cn.user.js` 触发 ScriptCat-VSCode 自动推送，只让用户测试角色/制作人员页面。测试通过后再决定是否把分支整理成单提交发布；测试不满意时保留 `main` 并删除功能分支。
