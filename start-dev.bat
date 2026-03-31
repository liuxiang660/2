@echo off
REM 启动完整应用（前端 + 后台） - Windows 版本

echo ===============================================
echo   Sentry Intelligence - 启动开发环境
echo ===============================================

echo.
echo 启动后台服务器...
start "Sentry Backend" cmd /k "cd /d %~dp0server && npm run dev"

echo 启动主前端...
start "Sentry Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo 启动独立管理端...
start "Sentry Admin" cmd /k "cd /d %~dp0admin && npm run dev"

echo.
echo ✓ 后台: http://localhost:3001
echo ✓ 主前端: http://localhost:3000
echo ✓ 管理端: http://localhost:3002
