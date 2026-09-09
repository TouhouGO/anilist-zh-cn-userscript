import OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 't', to: 'cn' });
const mainlandTerms: Array<[string, string]> = [
  ['動畫', '动画'], ['漫畫', '漫画'], ['電視', '电视'], ['劇場版', '剧场版'],
  ['特別篇', '特别篇'], ['特別編', '特别篇'], ['聲優', '声优'], ['聲', '声'],
  ['學', '学'], ['國', '国'], ['後', '后'], ['裡面', '里面'], ['裡', '里'],
  ['這', '这'], ['個', '个'], ['來', '来'], ['說', '说'], ['會', '会'],
  ['與', '与'], ['為', '为'], ['臺', '台'],
  // Common Japanese Shinjitai names to Mainland Simplified Chinese
  ['絵', '绘'], ['斎', '斋'], ['齋', '斋'], ['広', '广'], ['沢', '泽'],
  ['渋', '涩'], ['辺', '边'], ['邉', '边'], ['浜', '滨'], ['桜', '樱'],
  ['島', '岛'], ['黒', '黑'], ['竜', '龙'], ['徳', '德'], ['塩', '盐'],
  ['蔵', '藏'], ['豊', '丰'], ['実', '实'], ['戸', '户'], ['関', '关'],
  ['総', '总'], ['条', '条'], ['歩', '步'], ['塚', '冢'], ['聡', '聪'],
  ['純', '纯'], ['橋', '桥'], ['涼', '凉'], ['葉', '叶'], ['薫', '薰'],
  ['滝', '瀑'], ['栄', '荣'], ['寿', '寿'], ['仮', '假'], ['仏', '佛'],
];

export function toMainlandChinese(value: string): string {
  let result = converter(value);
  for (const [from, to] of mainlandTerms) result = result.replaceAll(from, to);
  return result;
}

export function normalizeEntityNativeName(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}
