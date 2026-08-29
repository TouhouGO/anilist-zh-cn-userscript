import OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 't', to: 'cn' });
const mainlandTerms: Array<[string, string]> = [
  ['動畫', '动画'], ['漫畫', '漫画'], ['電視', '电视'], ['劇場版', '剧场版'],
  ['特別篇', '特别篇'], ['特別編', '特别篇'], ['聲優', '声优'], ['聲', '声'],
  ['學', '学'], ['國', '国'], ['後', '后'], ['裡面', '里面'], ['裡', '里'],
  ['這', '这'], ['個', '个'], ['來', '来'], ['說', '说'], ['會', '会'],
  ['與', '与'], ['為', '为'], ['臺', '台'],
];

export function toMainlandChinese(value: string): string {
  let result = converter(value);
  for (const [from, to] of mainlandTerms) result = result.replaceAll(from, to);
  return result;
}

export function normalizeEntityNativeName(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}
