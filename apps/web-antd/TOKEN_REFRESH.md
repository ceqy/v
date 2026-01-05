# Token 自动刷新机制

本文档说明前端实现的 Token 自动刷新机制及测试方法。

## 功能概述

当用户的 `access_token` 过期时，系统会自动使用 `refresh_token` 获取新的 token，无需用户重新登录。

## 实现机制

### 1. 防并发刷新

使用单例模式防止多个并发请求同时触发 token 刷新：

```typescript
// src/api/request.ts
let refreshTokenPromise: Promise<string | null> | null = null;

async function doRefreshToken() {
  // 如果已经有刷新请求在进行中，直接返回该 Promise
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = (async () => {
    // 刷新逻辑...
  })();

  return refreshTokenPromise;
}
```

### 2. Token 更新流程

1. **检测过期**: 当 API 请求返回 401 错误时，触发 token 刷新
2. **刷新 Token**:
   - 从 localStorage 获取 `refresh_token`
   - 调用 `/auth/refresh` 接口
   - 获取新的 `access_token` 和 `refresh_token`
3. **更新 Token**:
   - 更新 Pinia store 中的 `access_token`
   - 更新 localStorage 中的 `refresh_token`
4. **重试请求**: 使用新 token 重试失败的请求

### 3. 失败处理

如果 token 刷新失败（refresh_token 也过期或无效）：

1. 清除所有 token
2. 跳转到登录页
3. 保留当前路由，登录后可返回

## 代码修改

### src/api/core/auth.ts

```typescript
/** 刷新 Token 返回值 */
export interface RefreshTokenResult {
  access_token: string;
  refresh_token: string; // ✅ 添加此字段
  token_type: string;
  expires_in: number;
}

/** 刷新 Token API */
export async function refreshTokenApi(refreshToken: string) {
  return requestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    refresh_token: refreshToken,
  });
}

/** 登出 API - 使用 access_token */
export async function logoutApi(accessToken: string) {
  return requestClient.post('/auth/logout', {
    access_token: accessToken, // ✅ 改为 access_token
  });
}
```

### src/api/request.ts

```typescript
async function doRefreshToken() {
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    await doReAuthenticate();
    return null;
  }

  refreshTokenPromise = (async () => {
    try {
      const resp = await refreshTokenApi(refreshToken);

      // ✅ 更新 access_token 到 store
      accessStore.setAccessToken(resp.access_token);

      // ✅ 更新 refresh_token 到 localStorage
      if (resp.refresh_token) {
        localStorage.setItem('refresh_token', resp.refresh_token);
      }

      return resp.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('refresh_token');
      await doReAuthenticate();
      return null;
    } finally {
      refreshTokenPromise = null;
    }
  })();

  return refreshTokenPromise;
}
```

### src/store/auth.ts

```typescript
async function logout(redirect: boolean = true) {
  try {
    // ✅ 使用 access_token 而不是 refresh_token
    const accessToken = accessStore.accessToken;
    if (accessToken) {
      await logoutApi(accessToken);
    }
  } catch {
    // 不做任何处理
  }

  localStorage.removeItem('refresh_token');
  resetAllStores();
  // ...
}
```

## 测试方法

### 方法一: 模拟 Token 过期

1. **登录系统**

   ```
   Email: admin@cuba-erp.com
   Password: Admin123
   ```

2. **打开浏览器开发者工具**
   - 按 F12
   - 切换到 Application 或 Storage 标签

3. **查看当前 Token**
   - LocalStorage: 查看 `refresh_token`
   - SessionStorage/Store: 查看 `access_token`

4. **手动修改 Token 使其失效**
   - 修改 `access_token` 的最后几个字符
   - 或者等待 1 小时让其自然过期

5. **触发 API 请求**
   - 访问任何受保护的页面
   - 或手动调用 API

6. **观察控制台**
   ```
   应该看到类似日志：
   POST /api/auth/refresh 200 OK
   然后原请求自动重试并成功
   ```

### 方法二: 浏览器控制台测试

```javascript
// 1. 获取当前 tokens
const accessToken = localStorage.getItem('access_token');
const refreshToken = localStorage.getItem('refresh_token');

// 2. 手动触发刷新
const response = await fetch('http://localhost:5666/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: refreshToken }),
});
const data = await response.json();
console.log('New tokens:', data);

// 3. 验证新 token
console.log('Old access token:', accessToken.slice(0, 50) + '...');
console.log('New access token:', data.access_token.slice(0, 50) + '...');
console.log('Tokens are different:', accessToken !== data.access_token);
```

### 方法三: 使用 cURL 测试后端

```bash
# 1. 登录获取 tokens
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@cuba-erp.com","password":"Admin123"}' \
  | jq -r '.refresh_token' > /tmp/refresh_token.txt

# 2. 刷新 token
REFRESH_TOKEN=$(cat /tmp/refresh_token.txt)
curl -X POST http://localhost:8082/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"'$REFRESH_TOKEN'"}' | jq .

# 3. 多次刷新验证（每次都应该得到新的 tokens）
for i in {1..3}; do
  echo "=== Refresh $i ==="
  curl -X POST http://localhost:8082/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d @- <<EOF | jq -r '.refresh_token' > /tmp/refresh_token.txt
{"refresh_token":"$(cat /tmp/refresh_token.txt)"}
EOF
  echo "New token saved"
done
```

## 验证清单

- [x] ✅ Token 过期时自动刷新
- [x] ✅ 刷新成功后更新 access_token
- [x] ✅ 刷新成功后更新 refresh_token
- [x] ✅ 并发请求只触发一次刷新
- [x] ✅ 刷新失败时跳转登录页
- [x] ✅ 登出时正确撤销 token
- [x] ✅ 撤销后的 token 无法使用

## 配置选项

在 `preferences` 中可以配置是否启用 token 刷新：

```typescript
// vite.config.ts 或应用配置
{
  app: {
    enableRefreshToken: true,  // 是否启用 token 刷新
    loginExpiredMode: 'modal', // 'modal' 或 'page'
  }
}
```

## Token 有效期

- **Access Token**: 1 小时（3600 秒）
- **Refresh Token**: 7 天（604800 秒）

## 安全考虑

1. **XSS 防护**:
   - Access token 存储在内存中（Pinia store）
   - Refresh token 存储在 localStorage
   - 使用 HttpOnly Cookie 会更安全（需后端支持）

2. **CSRF 防护**:
   - 使用 JWT 自带签名验证
   - 建议添加 CSRF token

3. **Token 轮转**:
   - 每次刷新都生成新的 refresh_token
   - 旧 refresh_token 立即失效

## 故障排查

### 问题: 无限刷新循环

**原因**: Refresh token API 也返回 401 **解决**: 检查 refresh token 是否有效，确保 `/auth/refresh` 不需要认证

### 问题: 多次刷新请求

**原因**: 未正确实现防并发机制 **解决**: 确保使用单例 Promise（已实现）

### 问题: 刷新后仍然 401

**原因**: 新 token 未正确设置到请求头 **解决**: 检查 request interceptor 是否正确读取新 token

## 后续优化建议

1. **提前刷新**: 在 token 过期前 5 分钟主动刷新
2. **静默刷新**: 后台定时刷新，用户无感知
3. **多标签页同步**: 使用 BroadcastChannel API 同步多个标签页的 token
4. **Token 指纹**: 绑定设备指纹，防止 token 被盗用
