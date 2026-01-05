#!/bin/bash

echo "========================================="
echo "Cuba ERP 登录测试脚本"
echo "========================================="
echo ""

# 设置后端地址（请根据实际情况修改）
BACKEND_HOST="${BACKEND_HOST:-localhost}"
BACKEND_PORT="${BACKEND_PORT:-8082}"
IAM_PORT="${IAM_PORT:-3000}"

echo "📍 测试后端地址: http://$BACKEND_HOST:$BACKEND_PORT"
echo ""

# 1. 测试 Gateway 健康检查
echo "1️⃣ 测试 API Gateway 健康检查..."
GATEWAY_HEALTH=$(curl -s -w "\n%{http_code}" "http://$BACKEND_HOST:$BACKEND_PORT/health" 2>/dev/null)
GATEWAY_STATUS=$(echo "$GATEWAY_HEALTH" | tail -n 1)

if [ "$GATEWAY_STATUS" = "200" ]; then
  echo "✅ Gateway 运行正常"
  echo "$GATEWAY_HEALTH" | head -n -1
else
  echo "❌ Gateway 无法访问 (HTTP $GATEWAY_STATUS)"
  echo "   请确认 Gateway 是否运行在 $BACKEND_HOST:$BACKEND_PORT"
fi
echo ""

# 2. 测试 IAM Service 健康检查（直接访问）
echo "2️⃣ 测试 IAM Service（直接访问）..."
IAM_HEALTH=$(curl -s -w "\n%{http_code}" "http://$BACKEND_HOST:$IAM_PORT/health" 2>/dev/null)
IAM_STATUS=$(echo "$IAM_HEALTH" | tail -n 1)

if [ "$IAM_STATUS" = "200" ]; then
  echo "✅ IAM Service 运行正常"
else
  echo "⚠️  IAM Service 无法访问 (HTTP $IAM_STATUS)"
  echo "   这可能是正常的（如果 IAM 只提供 gRPC）"
fi
echo ""

# 3. 测试注册接口（通过 Gateway）
echo "3️⃣ 测试用户注册（通过 Gateway）..."
REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "http://$BACKEND_HOST:$BACKEND_PORT/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser'$(date +%s)'",
    "email": "test'$(date +%s)'@cuba.com",
    "password": "Test123456!",
    "display_name": "Test User"
  }' 2>/dev/null)

REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | tail -n 1)

if [ "$REGISTER_STATUS" = "201" ] || [ "$REGISTER_STATUS" = "200" ]; then
  echo "✅ 注册接口正常 (HTTP $REGISTER_STATUS)"
  echo "$REGISTER_RESPONSE" | head -n -1 | jq . 2>/dev/null || echo "$REGISTER_RESPONSE" | head -n -1
elif [ "$REGISTER_STATUS" = "409" ]; then
  echo "⚠️  用户已存在 (HTTP 409)，这是正常的"
else
  echo "❌ 注册失败 (HTTP $REGISTER_STATUS)"
  echo "$REGISTER_RESPONSE" | head -n -1
fi
echo ""

# 4. 测试登录接口
echo "4️⃣ 测试用户登录（通过 Gateway）..."
echo "   测试账号: admin / Admin123!"

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "http://$BACKEND_HOST:$BACKEND_PORT/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin123!"
  }' 2>/dev/null)

LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -n 1)

if [ "$LOGIN_STATUS" = "200" ]; then
  echo "✅ 登录成功 (HTTP 200)"
  LOGIN_DATA=$(echo "$LOGIN_RESPONSE" | head -n -1)
  echo "$LOGIN_DATA" | jq . 2>/dev/null || echo "$LOGIN_DATA"

  # 提取 access_token
  ACCESS_TOKEN=$(echo "$LOGIN_DATA" | jq -r '.access_token' 2>/dev/null)

  if [ "$ACCESS_TOKEN" != "null" ] && [ -n "$ACCESS_TOKEN" ]; then
    echo ""
    echo "🔑 Access Token (前50字符): ${ACCESS_TOKEN:0:50}..."

    # 5. 测试获取用户信息
    echo ""
    echo "5️⃣ 测试获取用户信息..."
    USER_INFO=$(curl -s -w "\n%{http_code}" \
      "http://$BACKEND_HOST:$BACKEND_PORT/api/users/me" \
      -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null)

    USER_STATUS=$(echo "$USER_INFO" | tail -n 1)

    if [ "$USER_STATUS" = "200" ]; then
      echo "✅ 获取用户信息成功"
      echo "$USER_INFO" | head -n -1 | jq . 2>/dev/null || echo "$USER_INFO" | head -n -1
    else
      echo "❌ 获取用户信息失败 (HTTP $USER_STATUS)"
      echo "$USER_INFO" | head -n -1
    fi
  fi
elif [ "$LOGIN_STATUS" = "401" ]; then
  echo "❌ 登录失败：用户名或密码错误 (HTTP 401)"
  echo "$LOGIN_RESPONSE" | head -n -1
  echo ""
  echo "💡 提示：请先创建测试用户"
  echo "   curl -X POST http://$BACKEND_HOST:$BACKEND_PORT/api/auth/register \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -d '{\"username\":\"admin\",\"email\":\"admin@cuba.com\",\"password\":\"Admin123!\",\"display_name\":\"Admin\"}'"
else
  echo "❌ 登录失败 (HTTP $LOGIN_STATUS)"
  echo "$LOGIN_RESPONSE" | head -n -1
fi

echo ""
echo "========================================="
echo "测试完成"
echo "========================================="
echo ""
echo "📝 Vite 代理配置应该指向："
echo "   target: 'http://$BACKEND_HOST:$BACKEND_PORT'"
echo ""
echo "🔧 如果后端在其他机器，设置环境变量："
echo "   BACKEND_HOST=192.168.139.3 BACKEND_PORT=8082 ./test-login.sh"
echo ""
