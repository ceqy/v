import type { UserInfo } from '@vben/types';

import { baseRequestClient } from '#/api/request';

/**
 * 后端返回的用户信息格式
 */
interface BackendUserInfo {
  tenant_id: string;
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  email_verified: boolean;
  is_active: boolean;
  roles: string[];
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  // 使用 baseRequestClient 避免响应拦截器包装，后端直接返回数据
  const response: any = await baseRequestClient.get('/v1/auth/me');
  const backendUser = response.data.user as BackendUserInfo;

  // 将后端格式转换为 Vben 期望的格式
  const userInfo: UserInfo = {
    userId: backendUser.user_id,
    username: backendUser.username,
    realName: backendUser.display_name || backendUser.username,
    avatar:
      backendUser.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${backendUser.email}`,
    roles: backendUser.roles || [],
    desc: backendUser.email,
    homePath: '/analytics', // 根据路由配置，实际路径是 /analytics
    token: '', // token 已经在 store 中管理
  };

  return userInfo;
}
