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
