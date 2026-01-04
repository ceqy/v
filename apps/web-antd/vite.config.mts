import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            // Gateway API 地址
            target: 'http://localhost:8082',
            ws: true,
          },
        },
      },
    },
  };
});
