import type { UserInfo } from '@vben/types';

import { baseRequestClient } from '#/api/request';

/**
 * 后端返回的用户信息格式
 */
interface BackendUserInfo {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi(userId: string) {
  // 使用 baseRequestClient 避免响应拦截器包装，后端直接返回数据
  const response = await baseRequestClient.get<BackendUserInfo>(
    `/users/${userId}`,
  );
  const backendUser = response.data;

  // 将后端格式转换为 Vben 期望的格式
  const userInfo: UserInfo = {
    userId: backendUser.id,
    username: backendUser.email,
    realName: backendUser.display_name,
    avatar:
      backendUser.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${backendUser.email}`,
    roles: [], // 角色信息需要从权限接口获取
    desc: backendUser.email,
    homePath: '/analytics', // 根据路由配置，实际路径是 /analytics
    token: '', // token 已经在 store 中管理
  };

  return userInfo;
}
