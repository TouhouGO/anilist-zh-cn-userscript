import { describe, expect, it } from 'vitest';
import {
  checkBundleContract,
  getCodePointCount,
  validateStaffCharacters,
  validateT2sCharMap,
  validateTags,
  validateTitles,
// @ts-expect-error check-bundle-contract is an ES module (.mjs) without companion .d.ts
} from './check-bundle-contract.mjs';

function createValidBundle() {
  return {
    titles: {
      1: '星际牛仔',
      2: '星际牛仔：天国之门|123',
      non_numeric_fallback: '回退标题',
      '𠮷野家': '吉野家', // astral code point: [...key].length === 3, '𠮷野家'.length === 4
    },
    tags: {
      '4-koma': '四格',
      SciFi: '科幻',
    },
    staffCharacters: {
      person_100252: '彩虹乐团',
      char_11736: '阿姆罗·雷',
      name_daisuke_ono: '小野大辅',
      id_95000: '传统标识',
    },
    t2sCharMap: {
      龍: '龙',
      門: '门',
      '𠮷': '吉', // astral code point (1 code point each)
    },
  };
}

describe('check-bundle-contract', () => {
  describe('code point counting', () => {
    it('accurately counts Unicode code points rather than UTF-16 code units', () => {
      // 𠮷 is U+20BB7 in CJK Extension B, taking 2 UTF-16 code units (surrogate pair)
      const astralChar = '𠮷';
      expect(astralChar.length).toBe(2);
      expect(getCodePointCount(astralChar)).toBe(1);

      const textWithAstral = '𠮷野家';
      expect(textWithAstral.length).toBe(4);
      expect(getCodePointCount(textWithAstral)).toBe(3);
    });
  });

  describe('valid bundle acceptance', () => {
    it('accepts a valid bundle and returns expected entry counts', () => {
      const fixture = createValidBundle();
      const result = checkBundleContract(fixture);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.counts).toEqual({
        titles: 4,
        tags: 2,
        staffCharacters: 4,
        t2sCharMap: 3,
      });
    });
  });

  describe('contract violation enforcement', () => {
    it('rejects titles when value contains pipe but key is not numeric', () => {
      const titles = {
        'cowboy_bebop': '星际牛仔|1',
      };
      const errors = validateTitles(titles);
      expect(errors).toContain("titles_zh_cn.json entry with pipe '|' must have numeric key: cowboy_bebop");
    });

    it('rejects titles when numeric key is 0 or negative', () => {
      const titlesZero = { 0: '测试零' };
      const errorsZero = validateTitles(titlesZero);
      expect(errorsZero).toContain('titles_zh_cn.json numeric key must parse to positive Int: 0');

      const titlesNegative = { '-5': '测试负数' };
      const errorsNegative = validateTitles(titlesNegative);
      expect(errorsNegative).toContain('titles_zh_cn.json numeric key must parse to positive Int: -5');
    });

    it('rejects staff when key has illegal prefix or invalid pattern', () => {
      const staff = {
        actor_100252: '某声优',
        unknown_prefix: '未知角色',
      };
      const errors = validateStaffCharacters(staff);
      expect(errors).toContain('staff_characters_zh_cn.json contains invalid key pattern: actor_100252');
      expect(errors).toContain('staff_characters_zh_cn.json contains invalid key pattern: unknown_prefix');
    });

    it('rejects t2s mapping when key or value has multiple code points', () => {
      const t2s = {
        ab: 'c',
        d: 'ef',
      };
      const errors = validateT2sCharMap(t2s);
      expect(errors).toContain("t2s_char_map.json contains multi-codepoint mapping: 'ab' -> 'c'");
      expect(errors).toContain("t2s_char_map.json contains multi-codepoint mapping: 'd' -> 'ef'");
    });

    it('rejects titles with control characters or blank entries', () => {
      const titles = {
        'invalid\u0007key': '控制字符',
        '': '空键',
        'valid_key': '   ',
      };
      const errors = validateTitles(titles);
      expect(errors.some((e: string) => e.includes('control character'))).toBe(true);
      expect(errors.some((e: string) => e.includes('blank key or value'))).toBe(true);
    });

    it('rejects titles when pipe value contains invalid bangumi ID', () => {
      const titles = {
        123: '星际牛仔|invalid_id',
      };
      const errors = validateTitles(titles);
      expect(errors).toContain('titles_zh_cn.json contains invalid Bangumi ID after pipe: 星际牛仔|invalid_id');
    });

    it('rejects empty dictionaries', () => {
      expect(validateTitles({})).toContain('titles_zh_cn.json must not be empty');
      expect(validateTags({})).toContain('tags_zh_cn.json must not be empty');
      expect(validateStaffCharacters({})).toContain('staff_characters_zh_cn.json must not be empty');
      expect(validateT2sCharMap({})).toContain('t2s_char_map.json must not be empty');
    });
  });
});
