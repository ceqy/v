# Vben Admin + Cuba ERP 快速启动

## 🚀 快速开始

### 1. 启动 Cuba ERP 后端服务

```bash
cd /Users/x/Documents/cuba

# 启动 Docker 基础设施 + 运行迁移
make start

# 在 3 个终端分别启动服务：
# Terminal 1
make run-iam

# Terminal 2
make run-financial

# Terminal 3
make run-gateway
```

### 2. 启动前端项目

```bash
cd /Users/x/Documents/v/apps/web-antd

pnpm install
pnpm dev
```

访问: http://localhost:5173

### 3. 创建测试用户

```bash
# 方式 1: 通过 API Gateway
curl -X POST http://localhost:8082/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@cuba.com",
    "password": "Admin123!",
    "display_name": "Administrator"
  }'

# 方式 2: 通过 IAM Service REST API
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@cuba.com",
    "password": "Admin123!",
    "display_name": "Administrator"
  }'
```

### 4. 登录测试

在前端登录页面输入：

- **用户名**: `admin`
- **密码**: `Admin123!`

---

## 📋 服务端口

| 服务                     | 端口  | 访问地址               |
| ------------------------ | ----- | ---------------------- |
| 前端应用                 | 5173  | http://localhost:5173  |
| API Gateway              | 8082  | http://localhost:8082  |
| IAM Service (REST)       | 3000  | http://localhost:3000  |
| IAM Service (gRPC)       | 50051 | localhost:50051        |
| Financial Service (gRPC) | 50052 | localhost:50052        |
| PostgreSQL               | 5432  | localhost:5432         |
| Redis                    | 6379  | localhost:6379         |
| Prometheus               | 9090  | http://localhost:9090  |
| Grafana                  | 3000  | http://localhost:3000  |
| Jaeger                   | 16686 | http://localhost:16686 |

---

## 🔍 故障排查

### 前端无法连接后端

1. 检查 API Gateway 是否运行:

   ```bash
   lsof -i :8082
   ```

2. 检查 IAM Service REST API 是否运行:

   ```bash
   lsof -i :3000
   ```

3. 查看 Gateway 日志，确认请求转发:
   ```bash
   # Gateway 日志会显示类似信息：
   # Forwarding POST /api/auth/login -> http://localhost:3000/auth/login
   ```

### 登录失败

1. 确认用户已创建：

   ```bash
   # 测试登录接口
   curl -X POST http://localhost:8082/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"Admin123!"}'
   ```

2. 检查浏览器控制台的网络请求

3. 检查 IAM Service 日志

### 数据库连接问题

```bash
cd /Users/x/Documents/cuba

# 重置数据库
make db-reset

# 运行迁移
make migrate

# 查看服务状态
make status
```

---

## 📚 详细文档

- [完整集成文档](./CUBA_ERP_INTEGRATION.md)
- [Cuba ERP API 文档](/Users/x/Documents/cuba/docs/API_DOCUMENTATION.md)
- [Makefile 使用指南](/Users/x/Documents/cuba/MAKEFILE_GUIDE.md)

---

## ✅ 已完成的功能

- ✅ 用户登录
- ✅ 用户注册
- ✅ Token 刷新
- ✅ 用户登出
- ✅ 获取用户信息
- ✅ JWT 认证
- ✅ 权限码集成（当前返回空数组）

---

## 🔄 待开发功能

- ⏸️ 权限管理（角色、权限）
- ⏸️ 用户管理（列表、详情、编辑）
- ⏸️ 财务会计模块
- ⏸️ 审计日志查看
- ⏸️ 系统设置

---

**更新时间**: 2026-01-06
