import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub project Pages uses a repository prefix; local use keeps the root.
  base: process.env.VITE_BASE_PATH || '/',
});
