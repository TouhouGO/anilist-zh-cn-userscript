export type Section = 'global' | 'home' | 'search' | 'media' | 'list' | 'profile' | 'forum' | 'notifications' | 'settings' | 'other';
export type Route = { section: Section; type?: 'anime' | 'manga'; id?: number; path: string };
export type TranslationContext = { section: Section; element?: Element };
export type UiDictionary = Record<string, string>;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
