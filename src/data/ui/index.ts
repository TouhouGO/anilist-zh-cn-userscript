import type { UiDictionary } from '../../types';
import { forumUi } from './forum';
import { globalUi } from './global';
import { homeUi } from './home';
import { listUi } from './list';
import { mediaUi } from './media';
import { notificationsUi } from './notifications';
import { profileUi } from './profile';
import { searchUi } from './search';
import { settingsUi } from './settings';

export const uiZhCN: Record<string, UiDictionary> = {
  global: globalUi,
  home: homeUi,
  search: searchUi,
  media: mediaUi,
  list: listUi,
  profile: profileUi,
  forum: forumUi,
  notifications: notificationsUi,
  settings: settingsUi,
};

export const globalUiZhCN = uiZhCN.global;

