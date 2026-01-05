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
      // Cuba ERP 登录接口返回 access_token, refresh_token 和 user 信息
      const loginResult = await loginApi(params);

      // 如果成功获取到 access_token
      if (loginResult.access_token) {
        accessStore.setAccessToken(loginResult.access_token);

        // 保存 refresh_token 到 localStorage
        if (loginResult.refresh_token) {
          localStorage.setItem('refresh_token', loginResult.refresh_token);
        }

        // Cuba ERP 登录接口直接返回用户信息，不需要再次请求
        const cubaUser = loginResult.user;
        userInfo = {
          userId: cubaUser.user_id,
          username: cubaUser.username,
          realName: cubaUser.display_name || cubaUser.username,
          roles: cubaUser.roles || [],
          // Vben Admin 必需字段
          desc: cubaUser.email || '',
          homePath: '/dashboard', // 设置默认首页
          token: loginResult.access_token,
        };

        // 获取权限码（当前返回空数组）
        const accessCodes = await getAccessCodesApi();

        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
          });
        }
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    try {
      // Cuba ERP 需要传递 access_token
      const accessToken = accessStore.accessToken;
      if (accessToken) {
        await logoutApi(accessToken);
      }
    } catch {
      // 不做任何处理
    }
    // 清除 refresh_token
    localStorage.removeItem('refresh_token');
    resetAllStores();
    accessStore.setLoginExpired(false);

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
    // 获取 Cuba ERP 用户信息
    const cubaUserInfo = await getUserInfoApi();

    // 映射 Cuba ERP 数据到 Vben UserInfo 格式
    userInfo = {
      userId: cubaUserInfo.user_id || cubaUserInfo.userId,
      username: cubaUserInfo.username,
      realName:
        cubaUserInfo.display_name ||
        cubaUserInfo.realName ||
        cubaUserInfo.username,
      roles: cubaUserInfo.roles || [],
      desc: cubaUserInfo.email || '',
      homePath: '/dashboard',
      token: accessStore.accessToken || '',
    };

    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
