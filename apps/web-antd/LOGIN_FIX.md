# Cuba ERP 登录跳转问题修复

## 🐛 问题描述

登录成功（HTTP 200），但页面没有跳转到首页，仍停留在 `/auth/login` 页面。

## 🔍 根本原因

Vben Admin 的 `UserInfo` 类型需要以下必需字段：

- `userId` - 用户 ID
- `username` - 用户名
- `realName` - 真实姓名
- `roles` - 角色列表
- **`desc`** - 用户描述 ⚠️
- **`homePath`** - 首页路径 ⚠️
- **`token`** - Access Token ⚠️

之前的实现缺少了 `desc`、`homePath` 和 `token` 字段，导致用户信息不完整，跳转逻辑失败。

## ✅ 修复内容

### 文件：`src/store/auth.ts`

#### 1. 修复登录时的用户信息构建

```typescript
// Cuba ERP 登录接口直接返回用户信息，不需要再次请求
const cubaUser = loginResult.user;
userInfo = {
  userId: cubaUser.user_id,
  username: cubaUser.username,
  realName: cubaUser.display_name || cubaUser.username,
  roles: cubaUser.roles || [],
  // ✅ 添加 Vben Admin 必需字段
  desc: cubaUser.email || '', // 使用邮箱作为描述
  homePath: '/dashboard', // 设置默认首页
  token: loginResult.access_token, // 保存 access token
};
```

#### 2. 修复用户信息刷新函数

```typescript
async function fetchUserInfo() {
  let userInfo: null | UserInfo = null;
  // 获取 Cuba ERP 用户信息
  const cubaUserInfo = await getUserInfoApi();

  // ✅ 映射 Cuba ERP 数据到 Vben UserInfo 格式
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
```

## 🧪 测试步骤

### 1. 重启前端服务

```bash
cd /Users/x/Documents/v/apps/web-antd

# 停止当前服务（Ctrl+C）
# 重新启动
pnpm dev
```

### 2. 清除浏览器缓存

**重要：必须清除缓存！**

- 打开浏览器开发者工具 (F12)
- 右键刷新按钮 → "清空缓存并硬性重新加载"
- 或者使用 `Ctrl+Shift+Delete` 清除所有缓存

### 3. 重新登录

1. 访问登录页面
2. 输入用户名和密码（例如 `admin` / `Admin123!`）
3. 点击登录

**预期结果：**

- ✅ 登录成功后自动跳转到 `/dashboard` 页面
- ✅ 显示登录成功提示
- ✅ 用户信息正确显示在界面上

### 4. 验证跳转

打开浏览器开发者工具 → Network 标签：

1. 查看 `/auth/login` 请求：
   - Status: `200 OK`
   - Response: 包含 `access_token`, `refresh_token`, `user`

2. 页面应自动跳转到：
   - URL: `http://xxx:5666/dashboard`
   - 不再停留在 `/auth/login`

### 5. 测试页面刷新

1. 登录成功后，在 Dashboard 页面按 F5 刷新
2. 应该保持登录状态，不会跳转到登录页
3. 用户信息依然正确显示

## 📊 数据映射表

| Cuba ERP 字段       | Vben UserInfo 字段 | 来源     | 说明         |
| ------------------- | ------------------ | -------- | ------------ |
| `user.user_id`      | `userId`           | 登录响应 | 用户 UUID    |
| `user.username`     | `username`         | 登录响应 | 用户名       |
| `user.display_name` | `realName`         | 登录响应 | 显示名称     |
| `user.roles`        | `roles`            | 登录响应 | 角色数组     |
| `user.email`        | `desc`             | 登录响应 | 用户描述     |
| -                   | `homePath`         | 固定值   | `/dashboard` |
| `access_token`      | `token`            | 登录响应 | JWT Token    |

## 🔄 完整登录流程

```
1. 用户输入用户名/密码
   ↓
2. 调用 loginApi({username, password})
   ↓
3. 请求 POST /api/auth/login
   ↓
4. Cuba ERP 返回登录响应
   {
     access_token: "...",
     refresh_token: "...",
     user: {
       user_id: "...",
       username: "...",
       display_name: "...",
       email: "...",
       roles: [...]
     }
   }
   ↓
5. 保存 access_token 到 Store
   保存 refresh_token 到 localStorage
   ↓
6. 构建完整的 UserInfo 对象
   (包含所有必需字段)
   ↓
7. 调用 userStore.setUserInfo(userInfo)
   ↓
8. 跳转到 userInfo.homePath (/dashboard)
   ↓
9. 显示登录成功提示
   ✅ 完成！
```

## 🚨 常见问题

### Q1: 登录后仍然停留在登录页？

**解决方案：**

1. 清除浏览器缓存（必须！）
2. 检查浏览器控制台是否有错误
3. 检查 Network 标签中 `/auth/login` 响应数据
4. 确认返回的数据包含 `access_token` 和 `user` 字段

### Q2: 显示 "用户信息获取失败"？

**解决方案：**

1. 检查 `/api/users/me` 接口是否正常
2. 确认 access_token 已正确保存
3. 查看 `fetchUserInfo` 函数是否正确映射数据

### Q3: 刷新页面后需要重新登录？

**解决方案：**

1. 检查 refresh_token 是否保存到 localStorage
2. 确认 token 刷新逻辑是否正常
3. 查看 `src/api/request.ts` 中的 `doRefreshToken` 函数

### Q4: 跳转到错误的页面？

**解决方案：**

1. 检查 `homePath` 是否设置正确
2. 确认 `/dashboard` 路由是否存在
3. 可以修改 `homePath` 为其他有效路由

## 📝 自定义首页

如果您想更改登录后的默认首页，修改 `src/store/auth.ts`：

```typescript
// 在登录成功时
userInfo = {
  // ...其他字段
  homePath: '/your-custom-path', // 修改为您想要的路径
};

// 在 fetchUserInfo 时
userInfo = {
  // ...其他字段
  homePath: '/your-custom-path', // 保持一致
};
```

常用首页路径：

- `/dashboard` - 仪表盘
- `/analytics` - 数据分析
- `/workspace` - 工作台
- `/home` - 首页

## ✨ 验证清单

登录功能完全正常时，应满足：

- ✅ 登录成功返回 200 状态码
- ✅ 获取到 access_token 和 refresh_token
- ✅ 用户信息完整（包含所有必需字段）
- ✅ 自动跳转到 /dashboard 页面
- ✅ 显示登录成功提示
- ✅ 用户名在界面上正确显示
- ✅ 刷新页面保持登录状态
- ✅ Token 过期时自动刷新
- ✅ 登出功能正常

---

**修复时间**: 2026-01-06 **问题状态**: ✅ 已解决
