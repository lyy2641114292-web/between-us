@echo off
chcp 65001 >nul
title Between Us - 本地开发服务器
cd /d "%~dp0"

echo.
echo   ============================================
echo      Between Us  ·  正在启动
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] 没有找到 Node.js，请先安装：https://nodejs.org/zh-cn
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   [i] 首次运行，正在安装依赖，请稍候...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo   [!] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo   [i] 未找到 .env，正在从 .env.example 复制...
  copy /y ".env.example" ".env" >nul
  echo.
  echo   [!] 请打开 .env 文件，在 DEEPSEEK_API_KEY= 后面填写你的密钥
  echo       然后重新双击本文件启动。
  echo.
  pause
  exit /b 1
)

findstr /b /c:"DEEPSEEK_API_KEY=sk-" ".env" >nul 2>nul
if errorlevel 1 (
  echo   [!] 尚未填写 DEEPSEEK_API_KEY
  echo.
  echo       请用记事本打开 .env，在 DEEPSEEK_API_KEY= 后面粘贴你的密钥
  echo       （形如 sk-xxxxxxxxxxxx），保存后重新启动。
  echo.
  echo       未填写也可以启动，但 AI 功能会使用降级模板。
  echo.
  choice /c YN /m "   现在仍然启动吗"
  if errorlevel 2 exit /b 0
)

echo   [i] 前端：http://127.0.0.1:5200
echo   [i] 后端：http://127.0.0.1:8788
echo   [i] 按 Ctrl+C 停止服务
echo.

start "" http://127.0.0.1:5200
call npm run dev

echo.
echo   服务已停止。
pause
