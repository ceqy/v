import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, loginApi, logoutApi } from '#/api';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  const refreshToken = ref<null | string>(null);
  const userId = ref<null | string>(null);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const loginResult = await loginApi(params);

      // 如果成功获取到 accessToken
      if (loginResult.access_token) {
        accessStore.setAccessToken(loginResult.access_token);
        refreshToken.value = loginResult.refresh_token;
        userId.value = loginResult.user_id;

        // 获取用户信息并存储到 accessStore 中
        try {
          const [fetchUserInfoResult, accessCodes] = await Promise.all([
            fetchUserInfo(),
            getAccessCodesApi().catch((error) => {
              console.warn('获取权限码失败，使用空数组:', error);
              return [];
            }),
          ]);

          userInfo = fetchUserInfoResult;

          userStore.setUserInfo(userInfo);
          accessStore.setAccessCodes(accessCodes);
        } catch (error) {
          console.error('获取用户信息失败:', error);
          // 即使获取用户信息失败，也使用登录响应中的基本信息
          userInfo = {
            userId: loginResult.user_id,
            username: loginResult.display_name,
            realName: loginResult.display_name,
          } as UserInfo;
          userStore.setUserInfo(userInfo);
          accessStore.setAccessCodes([]);
        }

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo?.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName || loginResult.display_name) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName || loginResult.display_name}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      const token = accessStore.accessToken;
      if (token) {
        await logoutApi(token);
      }
    } catch {
      // 不做任何处理
    }
    resetAllStores();
    accessStore.setLoginExpired(false);
    refreshToken.value = null;
    userId.value = null;

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    if (userId.value) {
      userInfo = await getUserInfoApi(userId.value);
      userStore.setUserInfo(userInfo);
    }
    return userInfo;
  }

  function setRefreshToken(token: null | string) {
    refreshToken.value = token;
  }

  function $reset() {
    loginLoading.value = false;
    refreshToken.value = null;
    userId.value = null;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
    refreshToken,
    setRefreshToken,
    userId,
  };
});
