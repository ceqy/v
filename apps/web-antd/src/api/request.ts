/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

// Token 刷新Promise，用于防止并发刷新
let refreshTokenPromise: null | Promise<null | string> = null;

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑 - Cuba ERP 格式
   * 使用单例模式防止并发刷新
   */
  async function doRefreshToken() {
    // 如果已经有刷新请求在进行中，直接返回该 Promise
    if (refreshTokenPromise) {
      return refreshTokenPromise;
    }

    const accessStore = useAccessStore();
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      // 如果没有 refresh_token，直接重新认证
      await doReAuthenticate();
      return null;
    }

    // 创建刷新 Promise
    refreshTokenPromise = (async () => {
      try {
        const resp = await refreshTokenApi(refreshToken);
        const newAccessToken = resp.access_token;
        const newRefreshToken = resp.refresh_token;

        // 更新 access token 到 store
        accessStore.setAccessToken(newAccessToken);

        // 更新 refresh token 到 localStorage
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        return newAccessToken;
      } catch (error) {
        // 刷新失败，清除 refresh_token 并重新认证
        console.error('Token refresh failed:', error);
        localStorage.removeItem('refresh_token');
        await doReAuthenticate();
        return null;
      } finally {
        // 清除刷新 Promise，允许下次刷新
        refreshTokenPromise = null;
      }
    })();

    return refreshTokenPromise;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 处理返回的响应数据格式
  // Cuba ERP 直接返回数据，不需要解包
  client.addResponseInterceptor({
    fulfilled: (response) => {
      // 返回响应的 data 字段，Cuba ERP 的数据就在这里
      return response.data;
    },
  });

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
