import { describe, expect, it } from 'vitest';
import { applyEntityName, createEntityNameTranslator, extractEntityRef } from './entity-name-translator';
import type { EntityRef } from './entity-name-types';

type FakeTarget = HTMLElement & { children: unknown[]; isConnected: boolean };

function target(text: string): FakeTarget {
  return { textContent: text, dataset: {}, children: [], isConnected: true } as unknown as FakeTarget;
}

function link(path: string, nameTarget?: FakeTarget, text = ''): HTMLAnchorElement {
  const own = target(text) as unknown as HTMLAnchorElement;
  own.href = `https://anilist.co${path}`;
  own.matches = () => true;
  own.querySelector = () => nameTarget || null;
  own.querySelectorAll = () => [] as unknown as NodeListOf<Element>;
  return own;
}

function rootWith(links: HTMLAnchorElement[]): Element {
  return {
    matches: () => false,
    querySelectorAll: (selector: string) => selector.includes('a[') ? links : [],
  } as unknown as Element;
}

describe('Entity name translator', () => {
  it('extracts character and staff IDs', () => {
    expect(extractEntityRef('/character/1/Spike-Spiegel')).toEqual({ kind: 'character', id: 1 });
    expect(extractEntityRef('/staff/95011/Kouichi-Yamadera')).toEqual({ kind: 'staff', id: 95011 });
    expect(extractEntityRef('/anime/1/Cowboy-Bebop')).toBeUndefined();
  });

  it('stores the original name and updates a reused target safely', () => {
    const name = target('Spike Spiegel');
    expect(applyEntityName(name, { kind: 'character', id: 1 }, '史派克·斯皮格尔')).toBe(true);
    expect(name.textContent).toBe('史派克·斯皮格尔');
    expect(name.dataset.anilistZhCnEntityOriginal).toBe('Spike Spiegel');

    name.textContent = 'Faye Valentine';
    expect(applyEntityName(name, { kind: 'character', id: 2 }, '菲·瓦伦坦')).toBe(true);
    expect(name.textContent).toBe('菲·瓦伦坦');
    expect(name.dataset.anilistZhCnEntityOriginal).toBe('Faye Valentine');
  });

  it('batches duplicate entity links while updating every name target', async () => {
    const first = target('Spike Spiegel');
    const second = target('Spike Spiegel');
    const seen: EntityRef[][] = [];
    const service = { resolve: async (refs: EntityRef[]) => {
      seen.push(refs);
      return new Map([['character:1', { kind: 'character' as const, id: 1, name: '史派克·斯皮格尔', source: 'wikidata' as const }]]);
    } };
    const translator = createEntityNameTranslator(service, () => {});

    translator.translate(rootWith([
      link('/character/1/Spike-Spiegel', first),
      link('/character/1/Spike-Spiegel', second),
    ]));
    const count = await translator.flush();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual([{ kind: 'character', id: 1 }]);
    expect(count).toBe(2);
    expect(first.textContent).toBe('史派克·斯皮格尔');
    expect(second.textContent).toBe('史派克·斯皮格尔');
  });

  it('skips cover-only links without an independent name target', async () => {
    const cover = link('/character/1/Spike-Spiegel');
    Object.defineProperty(cover, 'children', { value: [{}] });
    let calls = 0;
    const translator = createEntityNameTranslator({ resolve: async () => { calls++; return new Map(); } }, () => {});

    translator.translate(rootWith([cover]));
    expect(await translator.flush()).toBe(0);
    expect(calls).toBe(0);
  });

  it('ignores a response that arrives after the route changes', async () => {
    let resolveRequest!: (value: Map<string, { kind: 'character'; id: number; name: string; source: 'wikidata' }>) => void;
    const response = new Promise<Map<string, { kind: 'character'; id: number; name: string; source: 'wikidata' }>>(resolve => { resolveRequest = resolve; });
    const name = target('Spike Spiegel');
    const translator = createEntityNameTranslator({ resolve: async () => response }, () => {});

    translator.translate(rootWith([link('/character/1/Spike-Spiegel', name)]));
    const flushing = translator.flush();
    translator.beginRoute();
    resolveRequest(new Map([['character:1', { kind: 'character', id: 1, name: '史派克·斯皮格尔', source: 'wikidata' }]]));

    expect(await flushing).toBe(0);
    expect(name.textContent).toBe('Spike Spiegel');
  });
});
