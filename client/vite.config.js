import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function validateApiUrl(apiUrl, requireInBuild) {
  if (!apiUrl) {
    if (requireInBuild) {
      throw new Error('VITE_API_URL is required for production Vercel/CI builds');
    }
    return;
  }
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error(`VITE_API_URL must be a valid absolute http(s) URL, received: "${apiUrl}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`VITE_API_URL must use http or https protocol, received: "${parsed.protocol}"`);
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || '';
  const requireApiUrl =
    command === 'build' &&
    mode === 'production' &&
    (process.env.VERCEL === '1' || process.env.REQUIRE_VITE_API_URL === 'true');

  validateApiUrl(apiUrl, requireApiUrl);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
            if (id.includes('@dnd-kit')) return 'dnd-vendor';
            if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
              return 'realtime-vendor';
            }
            if (id.includes('react-router')) return 'router-vendor';
            if (id.includes('@tanstack/react-query')) return 'query-vendor';
            return undefined;
          },
        },
      },
    },
  };
});
