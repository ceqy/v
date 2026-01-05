# Token 自动刷新测试指南

## 快速测试步骤

### 1. 登录系统

1. 启动前端开发服务器（如果还没启动）
2. 访问 http://localhost:5666
3. 使用以下凭证登录：
   - Email: `admin@cuba-erp.com`
   - Password: `Admin123`

### 2. 打开浏览器开发者工具

按 `F12` 打开开发者工具，切换到 **Console** 标签。

### 3. 验证 Token 刷新功能

在控制台执行以下代码：

```javascript
// 步骤 1: 获取当前的 tokens
const currentRefreshToken = localStorage.getItem('refresh_token');
console.log(
  'Current Refresh Token:',
  currentRefreshToken?.slice(0, 50) + '...',
);

// 步骤 2: 手动调用刷新 API
const testRefresh = async () => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: currentRefreshToken,
      }),
    });

    const data = await response.json();
    console.log('✅ Token refresh successful!');
    console.log('New Access Token:', data.access_token?.slice(0, 50) + '...');
    console.log('New Refresh Token:', data.refresh_token?.slice(0, 50) + '...');
    console.log('Token Type:', data.token_type);
    console.log('Expires In:', data.expires_in, 'seconds');

    // 验证 refresh_token 已更新
    const newRefreshToken = localStorage.getItem('refresh_token');
    console.log('\n🔍 Verification:');
    console.log(
      'Tokens are different:',
      currentRefreshToken !== newRefreshToken,
    );

    return data;
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
  }
};

// 执行测试
testRefresh();
```

### 4. 测试自动刷新（模拟 Token 过期）

```javascript
// 步骤 1: 保存当前的 access_token
const originalToken = localStorage.getItem('access_token');

// 步骤 2: 手动破坏 access_token（模拟过期）
// 注意：由于 access_token 在 Pinia store 中，我们需要通过 API 调用来触发
// 这里我们直接修改一个字符使其无效
const invalidToken = originalToken ? originalToken.slice(0, -5) + 'xxxxx' : '';
console.log('Setting invalid token to trigger refresh...');

// 步骤 3: 使用无效 token 调用受保护的 API
const testAutoRefresh = async () => {
  try {
    // 这个请求应该会触发 401，然后自动刷新 token 并重试
    const response = await fetch('/api/users/me', {
      headers: {
        Authorization: `Bearer ${invalidToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Auto refresh worked! User data:', data);
    } else {
      console.log('Response status:', response.status);
      const error = await response.json();
      console.log('Error:', error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
};

testAutoRefresh();
```

### 5. 测试并发刷新保护

```javascript
// 同时发起多个需要刷新的请求，应该只触发一次刷新
const testConcurrentRefresh = async () => {
  console.log('🔄 Testing concurrent refresh prevention...');

  // 打开 Network 标签观察，应该只看到一次 /auth/refresh 请求
  const promises = [
    fetch('/api/users/me'),
    fetch('/api/users/me'),
    fetch('/api/users/me'),
  ];

  const results = await Promise.all(promises);
  console.log('✅ All requests completed');
  console.log('Check Network tab - should only see ONE /auth/refresh request');
};

testConcurrentRefresh();
```

### 6. 测试登出

```javascript
const testLogout = async () => {
  console.log('🚪 Testing logout...');

  // 假设你在某个页面，可以通过以下方式触发登出
  // 或者直接点击 UI 上的登出按钮
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: localStorage.getItem('access_token'),
    }),
  });

  const data = await response.json();
  console.log('Logout response:', data);

  // 验证 token 已清除
  console.log(
    'Refresh token after logout:',
    localStorage.getItem('refresh_token'),
  );
};

testLogout();
```

## 预期结果

### ✅ Token 刷新成功

- Console 显示新的 access_token 和 refresh_token
- localStorage 中的 refresh_token 已更新
- 新旧 token 不同

### ✅ 自动刷新成功

- 使用无效 token 的请求会先失败
- 系统自动调用 /auth/refresh
- 使用新 token 重试原请求
- 最终请求成功

### ✅ 并发保护成功

- Network 标签只显示一次 /auth/refresh 请求
- 所有请求都等待刷新完成
- 所有请求使用相同的新 token

### ✅ 登出成功

- 返回 `{success: true, message: "Logged out successfully"}`
- localStorage 中的 refresh_token 被清除
- 页面跳转到登录页

## 观察要点

### Network 标签

1. 找到 `/auth/refresh` 请求
2. 查看 Request Payload: `{refresh_token: "..."}`
3. 查看 Response: `{access_token, refresh_token, token_type, expires_in}`

### Application 标签 (LocalStorage)

- 登录后: `refresh_token` 存在
- 刷新后: `refresh_token` 值改变
- 登出后: `refresh_token` 被删除

### Console 标签

- 应该看不到 "Token refresh failed" 错误
- 应该看到请求成功的日志

## 故障排查

### 问题: refresh_token 为 null

**解决**: 确保已登录，检查登录响应是否包含 refresh_token

### 问题: 401 Unauthorized

**解决**:

- 检查 refresh_token 是否有效
- 检查后端 `/auth/refresh` 接口是否正常
- 查看后端日志

### 问题: CORS 错误

**解决**:

- 检查 vite.config.ts 中的 proxy 配置
- 确保后端允许跨域

### 问题: 网络请求一直 pending

**解决**:

- 检查后端服务是否启动
- 确认端口号正确（Gateway: 8082, Frontend: 5666）

## 后端服务检查

如果测试失败，检查后端服务状态：

```bash
# 检查服务是否运行
lsof -i :3001  # IAM Service
lsof -i :8082  # Gateway

# 查看后端日志
# IAM Service 日志会显示刷新请求

# 测试后端 API
curl -X POST http://localhost:8082/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}' | jq .
```

## 下一步

测试成功后，可以：

1. 提交代码
2. 部署到测试环境
3. 进行完整的端到端测试
4. 添加性能监控
