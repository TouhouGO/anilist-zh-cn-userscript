import type { Section } from './types';
export const uiRoots: Record<Section, string[]> = {
  global: ['.nav', '.footer', '.search', '.dropdown'], home: ['.home'], search: ['.search-page', '.results'], media: ['.media', '.media-page'], list: ['.list', '.user-page'], profile: ['.user-page'], forum: ['.forum'], notifications: ['.notifications'], settings: ['.settings'], other: [],
};
export const protectedSelectors = ['.description', '.activity-markdown', '.forum-post', '.comment', '.review-text', '.user-name', '.username', '.character', '.staff'];
