#!/bin/bash
# 启动完整应用（前端 + 后台）

echo "==============================================="
echo "  Sentry Intelligence - 启动开发环境"
echo "==============================================="

# 检查后台进程
echo "启动后台服务器..."
cd server
npm install > /dev/null
npm run dev &
SERVER_PID=$!

# 等待后台启动
sleep 3

# 启动前端
echo "启动前端应用..."
cd ../
npm install > /dev/null
npm run dev &
FRONTEND_PID=$!

# 启动管理端
echo "启动独立管理端..."
cd admin
npm install > /dev/null
npm run dev &
ADMIN_PID=$!
cd ..

echo ""
echo "✓ 后台服务器运行于: http://localhost:3001"
echo "✓ 前端应用运行于: http://localhost:3000"
echo "✓ 管理端运行于: http://localhost:3002"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 清理
trap "kill $SERVER_PID $FRONTEND_PID $ADMIN_PID" EXIT

wait
