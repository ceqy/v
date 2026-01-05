import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            // 不需要 rewrite，因为 Cuba ERP Gateway 就是 /api 路径
            // rewrite: (path) => path.replace(/^\/api/, ''),
            // Cuba ERP API Gateway 地址
            target: 'http://localhost:8082',
            ws: true,
          },
        },
      },
    },
  };
});
