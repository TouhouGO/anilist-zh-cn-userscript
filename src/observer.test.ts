import { describe, expect, it } from 'vitest';
import { startMediaHoverObserver } from './observer';

describe('media hover observer', () => {
  it('keeps only the latest favourite when moving across covers', () => {
    let listener: ((event: { target: unknown }) => void) | undefined;
    const root = { addEventListener: (_: string, fn: typeof listener) => { listener = fn; }, removeEventListener: () => undefined };
    const scheduled: Array<() => void> = [];
    const seen: string[] = [];
    startMediaHoverObserver(path => seen.push(path), root as never, callback => { scheduled.push(callback); return 0 as never; });
    const target = (href: string) => ({ closest: () => ({ getAttribute: () => href }) });
    listener?.({ target: target('/anime/4720/WHITE-ALBUM/') });
    listener?.({ target: target('/anime/6165/WHITE-ALBUM-2/') });
    scheduled.forEach(callback => callback());
    expect(seen).toEqual(['/anime/6165/WHITE-ALBUM-2/', '/anime/6165/WHITE-ALBUM-2/', '/anime/6165/WHITE-ALBUM-2/']);
  });
});
