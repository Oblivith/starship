import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 is wired via its first-party Vite plugin (no tailwind.config.js
// needed). The shared components do NOT depend on Tailwind utilities — they are
// driven by the CSS variables in src/styles/tokens.css — so Tailwind is here for
// the page work in later sessions.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
  },
  worker: {
    format: 'es',
  },
});
