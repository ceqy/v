import { baseRequestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    username: string;
    password: string;
    tenantId?: string;
  }

  /** 用户信息(来自实际后端响应) */
  export interface UserInfo {
    tenant_id: string;
    user_id: string;
    username: string;
    email: string;
    display_name: string;
    avatar_url: string;
    email_verified: boolean;
    is_active: boolean;
    roles: string[];
    created_at: string;
    updated_at: string;
    last_login_at: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    access_token: string;
    refresh_token: string;
    expires_in: string;
    user: UserInfo;
    requires_2fa: boolean;
    account_locked: boolean;
    temp_token: string;
  }

  export interface RefreshTokenParams {
    refresh_token: string;
  }

  export interface RefreshTokenResult {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  }

  export interface LogoutParams {
    access_token: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  // 使用 baseRequestClient 避免响应拦截器包装，后端直接返回数据
  const response: any = await baseRequestClient.post('/v1/auth/login', data);
  return response.data as AuthApi.LoginResult;
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi(refreshToken: string) {
  const response: any = await baseRequestClient.post('/v1/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data as AuthApi.RefreshTokenResult;
}

/**
 * 退出登录
 */
export async function logoutApi(accessToken: string) {
  return baseRequestClient.post('/auth/logout', {
    access_token: accessToken,
  });
}

/**
 * 获取用户权限码
 * 注意：如果后端没有实现此接口，会在 store 中被捕获并使用空数组
 */
export async function getAccessCodesApi(_userId?: string) {
  // 暂时返回空数组，等后端实现权限接口后再对接
  // 后续可以调用: /permissions/users/${_userId}
  console.warn('权限码接口暂未实现，返回空数组');
  return [];
}
