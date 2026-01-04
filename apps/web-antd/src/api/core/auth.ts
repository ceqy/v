import { baseRequestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    email: string;
    password: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user_id: string;
    display_name: string;
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
  const response = await baseRequestClient.post<AuthApi.LoginResult>(
    '/auth/login',
    data,
  );
  return response.data;
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi(refreshToken: string) {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    refresh_token: refreshToken,
  });
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
