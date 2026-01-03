
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  server: {
    host: '0.0.0.0',
  },
  build: {
    target: 'esnext'
  }
});
