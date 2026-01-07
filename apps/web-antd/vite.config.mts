import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            // Auth Service 地址
            target: 'http://localhost:8080',
            ws: true,
          },
        },
      },
    },
  };
});
