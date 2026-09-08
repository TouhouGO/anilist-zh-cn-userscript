import { uiZhCN } from '../src/data/ui-zh-CN';
const required = ['global', 'home', 'search', 'media', 'list', 'profile', 'forum', 'notifications', 'settings'];
const missing = required.filter(section => !uiZhCN[section]);
if (missing.length) { console.error(`Missing dictionary sections: ${missing.join(', ')}`); process.exit(1); }
console.log(`AniList zh-CN dictionary sections: ${required.length}/${required.length}`);
