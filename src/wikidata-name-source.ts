import { toMainlandChinese } from './chinese-normalizer';
import type { EntityKind, EntityNameMap, EntityNameSource } from './entity-name-types';
import { requestJson, type JsonRequester } from './json-request';

type WikidataBinding = {
  anilistId?: { value?: string };
  itemLabel?: { value?: string };
};

type WikidataPayload = {
  results?: { bindings?: WikidataBinding[] };
};

const properties: Record<EntityKind, string> = {
  character: 'P11736',
  staff: 'P11227',
};
const MAX_IDS_PER_REQUEST = 30;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function buildQuery(kind: EntityKind, ids: number[]): string {
  const values = ids.map(id => `"${id}"`).join(' ');
  return `SELECT ?anilistId ?itemLabel WHERE {
  VALUES ?anilistId { ${values} }
  ?item wdt:${properties[kind]} ?anilistId.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-cn,zh-hans,zh". }
}`;
}

export function createWikidataNameSource(requester: JsonRequester = requestJson): EntityNameSource {
  return {
    async load(kind, ids) {
      const uniqueIds = [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
      if (!uniqueIds.length) return new Map();
      const requested = new Set(uniqueIds);
      const result: EntityNameMap = new Map();

      for (const batch of chunks(uniqueIds, MAX_IDS_PER_REQUEST)) {
        const query = buildQuery(kind, batch);
        const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
        const payload = await requester(url) as WikidataPayload;
        for (const row of payload.results?.bindings || []) {
          const id = Number(row.anilistId?.value);
          const name = toMainlandChinese(row.itemLabel?.value?.trim() || '');
          if (requested.has(id) && /[\p{Script=Han}]/u.test(name)) result.set(id, name);
        }
      }

      return result;
    },
  };
}
