import ts from 'typescript';

type StringDictionary = Record<string, string>;

export type DictionaryData = {
  ui: Record<string, StringDictionary>;
  baseTags: StringDictionary;
  communityTags: StringDictionary;
  titleOverrides: Record<number, string>;
};

const requiredUiSections = [
  'global',
  'home',
  'search',
  'media',
  'list',
  'profile',
  'forum',
  'notifications',
  'settings',
] as const;

function validateStringDictionary(label: string, dictionary: StringDictionary): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(dictionary)) {
    if (!key.trim()) errors.push(`${label}：存在空键`);
    if (!value.trim()) errors.push(`${label}/${key || '(空键)'}：译文为空`);
  }
  return errors;
}

export function validateDictionaryData(data: DictionaryData): string[] {
  const errors: string[] = [];

  for (const section of requiredUiSections) {
    const dictionary = data.ui[section];
    if (!dictionary) {
      errors.push(`UI：缺少页面域 ${section}`);
      continue;
    }
    errors.push(...validateStringDictionary(`UI/${section}`, dictionary));
  }

  errors.push(...validateStringDictionary('标签基础词典', data.baseTags));
  errors.push(...validateStringDictionary('标签社区修正', data.communityTags));

  for (const [key, value] of Object.entries(data.communityTags)) {
    if (data.baseTags[key] === value) {
      errors.push(`标签社区修正/${key}：与基础译名相同，请删除重复项`);
    }
  }

  for (const [id, title] of Object.entries(data.titleOverrides)) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      errors.push(`标题修正/${id}：AniList ID 必须是正整数`);
    }
    if (!title.trim()) errors.push(`标题修正/${id}：译文为空`);
  }

  return errors;
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  if (!('name' in property) || !property.name) return undefined;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) {
    return property.name.text;
  }
  return undefined;
}

export function findDuplicateObjectKeys(sourceText: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set<string>();
      for (const property of node.properties) {
        const name = propertyName(property);
        if (name && seen.has(name)) errors.push(`${fileName}：对象中存在重复键 ${name}`);
        if (name) seen.add(name);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return errors;
}
