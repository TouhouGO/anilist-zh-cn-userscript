import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('generated title supplement', () => {
  it('declares its schema and keeps AniList IDs unique and ascending', async () => {
    const supplement = JSON.parse(await readFile('data/title-supplement.json', 'utf8')) as {
      schemaVersion?: number;
      sources?: string[];
      entries: Array<{ id: number }>;
    };
    const ids = supplement.entries.map((entry) => entry.id);

    expect(supplement.schemaVersion).toBe(1);
    expect(supplement.sources?.length).toBeGreaterThan(0);
    expect(ids).toEqual([...new Set(ids)].sort((left, right) => left - right));
  });
});
