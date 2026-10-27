@echo off
title PayomboyZ Discord Intelligence Bot
color 0b
echo ======================================================
echo    PAYOMBOYZ DISCORD BOT - SCRIPT INTELLIGENCE
echo ======================================================
echo.
cd /d "%~dp0"

if not exist node_modules (
    echo [INFO] Installing required dependencies...
    call npm install
)

echo [STARTING] Launching PayomboyZ Discord Bot...
echo.
node bot.js
pause
