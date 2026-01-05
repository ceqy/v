import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取当前用户信息 - Cuba ERP API
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/users/me');
}
