@echo off
chcp 65001 >nul
echo ===================================================
echo   ST Toolbox (Pi Edition) - 1-Click Installer
echo ===================================================
echo.

set SCRIPT_DIR=%~dp0
set ST_DIR=%~dp0..\..\..\..

if exist "%ST_DIR%\server.js" (
    goto FOUND_ST
)

set ST_DIR=%~dp0..
if exist "%ST_DIR%\server.js" (
    goto FOUND_ST
)

set /p ST_DIR="请输入 SillyTavern 根目录绝对路径 (例如 C:\SillyTavern): "

:FOUND_ST
echo [1/3] 检测到 SillyTavern 根目录: %ST_DIR%

REM 1. 部署客户端扩展
set CLIENT_TARGET=%ST_DIR%\public\scripts\extensions\third-party\st-toolbox
if not exist "%CLIENT_TARGET%" mkdir "%CLIENT_TARGET%"
xcopy /E /Y /I "%SCRIPT_DIR%*" "%CLIENT_TARGET%\" >nul
echo [2/3] 客户端扩展已安装至: %CLIENT_TARGET%

REM 2. 部署服务端插件
set SERVER_TARGET=%ST_DIR%\plugins\st-toolbox
if not exist "%SERVER_TARGET%" mkdir "%SERVER_TARGET%"
xcopy /E /Y /I "%SCRIPT_DIR%*" "%SERVER_TARGET%\" >nul
echo [3/3] 服务端插件已安装至: %SERVER_TARGET%

echo.
echo ===================================================
echo   安装完成！请确保 config.yaml 中已开启:
echo   enableServerPlugins: true
echo ===================================================
pause
