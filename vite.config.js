import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function mobileServePlugin() {
  return {
    name: 'serve-mobile-dist',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/mobile') || url.startsWith('/_expo') || (url.startsWith('/assets/') && (url.includes('.ttf') || url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg')))) {
          let filePath = '';
          if (url.startsWith('/mobile')) {
            const rel = url.replace(/^\/mobile\/?/, '').split('?')[0].split('#')[0];
            filePath = rel ? path.join(__dirname, 'dist', 'mobile', rel) : path.join(__dirname, 'dist', 'mobile', 'index.html');
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
              filePath = path.join(__dirname, 'dist', 'mobile', 'index.html');
            }
          } else {
            const rel = url.split('?')[0].split('#')[0];
            filePath = path.join(__dirname, 'dist', rel);
            if (!fs.existsSync(filePath)) {
              filePath = path.join(__dirname, 'dist', 'mobile', rel);
            }
          }
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
              '.html': 'text/html; charset=utf-8',
              '.js': 'application/javascript',
              '.css': 'text/css',
              '.json': 'application/json',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.svg': 'image/svg+xml',
              '.ttf': 'font/ttf',
              '.woff': 'font/woff',
              '.woff2': 'font/woff2',
              '.ico': 'image/x-icon'
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), mobileServePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ['**/mobile/**', '**/supabase/**']
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      external: ['mobile/**', 'supabase/**']
    }
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions']
  }
});