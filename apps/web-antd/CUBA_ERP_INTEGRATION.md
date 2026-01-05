# Cuba ERP 前端集成完成文档

## 📋 集成概述

本文档记录了 Vben Admin 前端项目与 Cuba ERP 后端 API 的完整集成过程。

### 后端服务信息

- **API Gateway**: `http://localhost:8082`
- **IAM Service (gRPC)**: `localhost:50051`
- **IAM Service (REST)**: `http://localhost:3000`
- **Financial Service (gRPC)**: `localhost:50052`

### API 文档

详见：`/Users/x/Documents/cuba/docs/API_DOCUMENTATION.md`

---

## ✅ 已完成的修改

### 1. Vite 代理配置

**文件**: `vite.config.mts`

```typescript
export default defineConfig(async () => {
  return {
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            // Cuba ERP API Gateway 地址
            target: 'http://localhost:8082',
            ws: true,
          },
        },
      },
    },
  };
});
```

**说明**: 将所有 `/api` 请求代理到 Cuba ERP API Gateway。

---

### 2. 登录接口适配

**文件**: `src/api/core/auth.ts`

#### 接口类型定义

```typescript
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
      user_id: string;
      username: string;
      email: string;
      display_name: string;
      roles: string[];
    };
  }

  /** 刷新 Token 返回值 */
  export interface RefreshTokenResult {
    access_token: string;
    token_type: string;
    expires_in: number;
  }
}
```

#### 接口实现

```typescript
/**
 * 登录 - Cuba ERP API
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/api/auth/login', data);
}

/**
 * 刷新 accessToken - Cuba ERP 格式
 */
export async function refreshTokenApi(refreshToken: string) {
  return requestClient.post<AuthApi.RefreshTokenResult>('/api/auth/refresh', {
    refresh_token: refreshToken,
  });
}

/**
 * 退出登录 - Cuba ERP 格式
 */
export async function logoutApi(refreshToken: string) {
  return requestClient.post('/api/auth/logout', {
    refresh_token: refreshToken,
  });
}

/**
 * 获取用户权限码
 * Cuba ERP 暂不使用权限码，返回空数组
 */
export async function getAccessCodesApi() {
  return Promise.resolve([]);
}
```

---

### 3. 用户信息接口适配

**文件**: `src/api/core/user.ts`

```typescript
/**
 * 获取当前用户信息 - Cuba ERP API
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/api/users/me');
}
```

**说明**: Cuba ERP API 端点为 `/api/users/me`。

---

### 4. 认证 Store 修改

**文件**: `src/store/auth.ts`

#### 登录逻辑

```typescript
async function authLogin(
  params: Recordable<any>,
  onSuccess?: () => Promise<void> | void,
) {
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
      };

      // 获取权限码（当前返回空数组）
      const accessCodes = await getAccessCodesApi();

      userStore.setUserInfo(userInfo);
      accessStore.setAccessCodes(accessCodes);

      // 导航到首页或执行成功回调
      if (accessStore.loginExpired) {
        accessStore.setLoginExpired(false);
      } else {
        onSuccess
          ? await onSuccess?.()
          : await router.push(
              userInfo.homePath || preferences.app.defaultHomePath,
            );
      }

      // 显示登录成功提示
      if (userInfo?.realName) {
        notification.success({
          description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
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
```

#### 登出逻辑

```typescript
async function logout(redirect: boolean = true) {
  try {
    // Cuba ERP 需要传递 refresh_token
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await logoutApi(refreshToken);
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
```

---

### 5. 请求拦截器配置

**文件**: `src/api/request.ts`

#### 响应数据格式处理

```typescript
// 处理返回的响应数据格式
// Cuba ERP 直接返回数据，不需要解包
client.addResponseInterceptor({
  fulfilled: (response) => {
    // 直接返回响应数据，不进行 code/data 解包
    return response;
  },
});
```

**说明**: Cuba ERP API 直接返回数据对象，不使用 `{code: 0, data: ...}` 包装格式。

#### Token 刷新逻辑

```typescript
/**
 * 刷新token逻辑 - Cuba ERP 格式
 */
async function doRefreshToken() {
  const accessStore = useAccessStore();
  const refreshToken = localStorage.getItem('refresh_token');

  if (!refreshToken) {
    // 如果没有 refresh_token，直接重新认证
    await doReAuthenticate();
    return null;
  }

  try {
    const resp = await refreshTokenApi(refreshToken);
    const newToken = resp.access_token;
    accessStore.setAccessToken(newToken);
    return newToken;
  } catch (error) {
    // 刷新失败，清除 refresh_token 并重新认证
    localStorage.removeItem('refresh_token');
    await doReAuthenticate();
    return null;
  }
}
```

---

## 🔧 Cuba ERP API 特点

### 1. 响应格式

**成功响应**: 直接返回数据对象

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": { ... }
}
```

**错误响应**: 包含 error 和 message 字段

```json
{
  "error": "invalid_credentials",
  "message": "Invalid username or password",
  "details": { ... }
}
```

### 2. 认证流程

1. **登录**: `POST /api/auth/login`
   - 输入: `{username, password}`
   - 输出: `{access_token, refresh_token, user}`

2. **Token 使用**:
   - Header: `Authorization: Bearer {access_token}`
   - Token 有效期: 3600 秒 (1小时)

3. **Token 刷新**: `POST /api/auth/refresh`
   - 输入: `{refresh_token}`
   - 输出: `{access_token, expires_in}`

4. **登出**: `POST /api/auth/logout`
   - 输入: `{refresh_token}`
   - 撤销 refresh_token

### 3. 用户信息

登录时直接返回用户信息，包含：

- `user_id`: UUID
- `username`: 用户名
- `email`: 邮箱
- `display_name`: 显示名称
- `roles`: 角色列表

---

## 🚀 测试说明

### 启动服务

#### 后端服务

```bash
# 在 /Users/x/Documents/cuba 目录

# 1. 启动基础设施
make docker-up

# 2. 运行数据库迁移
make migrate

# 3. 启动业务服务（需要 3 个终端）
make run-iam         # Terminal 1
make run-financial   # Terminal 2
make run-gateway     # Terminal 3

# 或者查看服务状态
make status
```

#### 前端服务

```bash
# 在 /Users/x/Documents/v/apps/web-antd 目录

pnpm install
pnpm dev
```

### 创建测试用户

#### 方式 1: 通过 API

```bash
curl -X POST http://localhost:8082/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "testuser@cuba.com",
    "password": "Test123456!",
    "display_name": "Test User"
  }'
```

#### 方式 2: 通过 IAM Service REST API

IAM Service 提供了 REST API 在端口 3000：

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@cuba.com",
    "password": "Admin123!",
    "display_name": "Administrator"
  }'
```

### 测试登录

使用创建的用户登录：

- 用户名: `testuser` 或 `admin`
- 密码: `Test123456!` 或 `Admin123!`

---

## 📝 数据映射

### Cuba ERP → Vben Admin

| Cuba ERP 字段       | Vben Admin 字段 | 说明              |
| ------------------- | --------------- | ----------------- |
| `access_token`      | `accessToken`   | 访问令牌          |
| `user.user_id`      | `userId`        | 用户 ID           |
| `user.username`     | `username`      | 用户名            |
| `user.display_name` | `realName`      | 显示名称/真实姓名 |
| `user.roles`        | `roles`         | 角色列表          |
| `refresh_token`     | localStorage    | 刷新令牌          |

---

## ⚠️ 注意事项

### 1. Gateway 路由配置

当前 Gateway 的路由配置将 `/api` 请求转发到 `http://localhost:3000` (IAM Service REST API)。

如果需要访问财务服务，需要配置额外的路由规则。

### 2. 权限码功能

当前实现中，权限码功能返回空数组，可以在未来根据需要对接 Cuba ERP 的权限管理 API。

### 3. Token 存储

- `access_token`: 存储在 Pinia store (内存中)
- `refresh_token`: 存储在 localStorage

建议在生产环境中考虑使用更安全的存储方式（如 httpOnly cookie）。

### 4. 用户信息刷新

登录时用户信息会随 token 一起返回，避免了额外的 API 请求。

如果需要刷新用户信息，可以调用 `/api/users/me` 接口。

---

## 🔄 下一步建议

### 1. 完善权限管理

对接 Cuba ERP 的权限 API：

- GET `/api/permissions/check` - 检查权限
- GET `/api/roles` - 获取角色列表

### 2. 添加用户管理功能

- 用户列表页面 - `/api/users`
- 用户详情页面 - `/api/users/{id}`
- 用户编辑功能 - `PUT /api/users/{id}`

### 3. 集成财务会计模块

对接财务服务 API：

- 凭证管理 - `/api/financial/journal-entries`
- 过账操作 - `/api/financial/journal-entries/{id}/post`
- 审计日志 - `/api/financial/audit-logs`

### 4. 添加错误处理

完善错误响应的处理逻辑，根据 `error` 字段显示友好的错误提示。

---

## 📊 API 端点汇总

### 认证相关

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新 Token
- `POST /api/auth/logout` - 退出登录

### 用户相关

- `GET /api/users/me` - 获取当前用户信息
- `PUT /api/users/me` - 更新当前用户信息
- `POST /api/users/me/change-password` - 修改密码
- `GET /api/users` - 获取用户列表（管理员）
- `POST /api/users` - 创建用户（管理员）

### 角色权限

- `GET /api/roles` - 获取角色列表
- `GET /api/permissions` - 获取权限列表
- `POST /api/permissions/check` - 检查权限

---

## 📖 相关文档

- Cuba ERP API 文档: `/Users/x/Documents/cuba/docs/API_DOCUMENTATION.md`
- Cuba ERP 快速启动: `/Users/x/Documents/cuba/docs/QUICK_START_GUIDE.md`
- Vben 登录文档: `/Users/x/Documents/v/docs/src/guide/in-depth/login.md`

---

**集成完成时间**: 2026-01-06 **版本**: Cuba ERP v0.1.0 + Vben Admin v5.x
