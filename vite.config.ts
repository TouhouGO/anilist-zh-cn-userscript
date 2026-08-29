import { defineConfig } from 'vite';
import { userscriptMetadata } from './scripts/userscript-metadata';

export default defineConfig({
  build: {
    lib: { entry: 'src/main.ts', name: 'AniListZhCN', formats: ['iife'], fileName: () => 'anilist-zh-cn.user.js' },
    minify: false,
    rollupOptions: { output: { inlineDynamicImports: true, banner: userscriptMetadata } },
  },
});
