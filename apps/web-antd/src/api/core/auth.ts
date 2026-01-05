import { requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password: string;
    username: string; // 可以是用户名或邮箱
  }

  /** 登录接口返回值 - Cuba ERP 格式 */
  export interface LoginResult {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: {
      display_name: string;
      email: string;
      roles: string[];
      user_id: string;
      username: string;
    };
  }

  /** 刷新 Token 返回值 */
  export interface RefreshTokenResult {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  }
}

/**
 * 登录 - Cuba ERP API
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 刷新 accessToken - Cuba ERP 格式
 */
export async function refreshTokenApi(refreshToken: string) {
  return requestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    refresh_token: refreshToken,
  });
}

/**
 * 退出登录 - Cuba ERP 格式
 * 需要传递 access_token 并附带 Authorization header
 */
export async function logoutApi(accessToken: string) {
  return requestClient.post('/auth/logout', {
    access_token: accessToken,
  });
}

/**
 * 获取用户权限码
 * Cuba ERP 暂不使用权限码，返回空数组
 */
export async function getAccessCodesApi() {
  // 暂不使用权限码功能，返回空数组
  return [];
}
