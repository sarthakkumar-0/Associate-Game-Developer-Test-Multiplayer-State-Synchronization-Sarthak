@echo off
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies. Please ensure Node.js is installed.
    pause
    exit /b %errorlevel%
)

echo Starting server...
node index.js
pause
