import type { Recordable, UserInfo } from '@vben/types';

import type { AuthApi } from '#/api';

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
      const loginResult = await loginApi(params as AuthApi.LoginParams);

      // 如果成功获取到 accessToken
      if (loginResult.access_token) {
        accessStore.setAccessToken(loginResult.access_token);
        refreshToken.value = loginResult.refresh_token;
        userId.value = loginResult.user.user_id;

        // 直接使用登录响应中的用户信息
        userInfo = {
          userId: loginResult.user.user_id,
          username: loginResult.user.username,
          realName: loginResult.user.display_name || loginResult.user.username,
          homePath: '/analytics',
          roles: loginResult.user.roles || [],
          avatar:
            loginResult.user.avatar_url ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginResult.user.email}`,
          desc: loginResult.user.email,
          token: loginResult.access_token,
        };

        userStore.setUserInfo(userInfo);

        // 尝试获取权限码，但不阻塞登录流程
        try {
          const accessCodes = await getAccessCodesApi();
          accessStore.setAccessCodes(accessCodes);
        } catch (error) {
          console.warn('获取权限码失败，使用空数组:', error);
          accessStore.setAccessCodes([]);
        }

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (
          userInfo.realName ||
          loginResult.user.display_name ||
          loginResult.user.username
        ) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo.realName || loginResult.user.display_name || loginResult.user.username}`,
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
      userInfo = await getUserInfoApi();
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
