export type EntityKind = 'character' | 'staff';
export type EntityRef = { kind: EntityKind; id: number };
export type EntityNameMap = Map<number, string>;

export type EntityNameSource = {
  load(kind: EntityKind, ids: number[]): Promise<EntityNameMap>;
};
