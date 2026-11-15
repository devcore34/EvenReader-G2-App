import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@even-reader/evr-format': path.resolve(__dirname, './src/evr-format/index.ts')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  }
});
