@echo off
REM Bun Development Script for Swappy
REM Usage: bun-dev.bat [command]
REM Commands: dev, build, preview, install, clean

set BUN_PATH=%USERPROFILE%\.bun\bin\bun.exe
set PROJECT_DIR=%~dp0

REM Check if Bun is installed
if not exist "%BUN_PATH%" (
    echo Bun not found at %BUN_PATH%
    echo Install Bun from https://bun.sh
    exit /b 1
)

REM Default command
if "%~1"=="" set "COMMAND=dev"
if not "%~1"=="" set "COMMAND=%~1"

echo ==========================================
echo Swappy Video Shader Project
echo Command: %COMMAND%
echo Bun: %BUN_PATH%
echo ==========================================

cd /d "%PROJECT_DIR%"

if "%COMMAND%"=="dev" (
    echo Starting development server on http://localhost:5174
    "%BUN_PATH%" --bun run vite --host --port 5174
) else if "%COMMAND%"=="build" (
    echo Building project...
    "%BUN_PATH%" --bun run vite build
) else if "%COMMAND%"=="preview" (
    echo Starting preview server on http://localhost:5175
    "%BUN_PATH%" --bun run vite preview --port 5175
) else if "%COMMAND%"=="install" (
    echo Installing dependencies with Bun...
    "%BUN_PATH%" install
    echo.
    echo Installing additional dependencies...
    "%BUN_PATH%" add three@^0.178.0 mp4box@^1.2.0 @types/three@^0.178.0
) else if "%COMMAND%"=="clean" (
    echo Cleaning project...
    rmdir /s /q dist 2>nul
    rmdir /s /q .svelte-kit 2>nul
    del bun.lock 2>nul
    echo Clean complete!
) else if "%COMMAND%"=="deps" (
    echo Installing project dependencies...
    "%BUN_PATH%" install
) else (
    echo Unknown command: %COMMAND%
    echo.
    echo Usage: bun-dev.bat [dev^|build^|preview^|install^|clean^|deps]
    echo   dev      - Start development server
    echo   build    - Build for production
    echo   preview  - Preview production build
    echo   install  - Install all dependencies including Three.js
    echo   deps     - Install basic dependencies
    echo   clean    - Clean build artifacts
)

pause
