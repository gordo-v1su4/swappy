#!/bin/bash
# Bun Development Script for Swappy
# Usage: ./bun-dev.sh [command]
# Commands: dev, build, preview, install, clean

BUN_PATH="$HOME/.bun/bin/bun"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Bun is installed
if [ ! -f "$BUN_PATH" ]; then
    echo "Bun not found at $BUN_PATH"
    echo "Install Bun from https://bun.sh"
    exit 1
fi

# Default command
COMMAND="${1:-dev}"

echo "=========================================="
echo "Swappy Video Shader Project"
echo "Command: $COMMAND"
echo "Bun: $BUN_PATH"
echo "=========================================="

cd "$PROJECT_DIR"

case $COMMAND in
    dev)
        echo "Starting development server on http://localhost:5174"
        "$BUN_PATH" --bun run vite --host --port 5174
        ;;
    build)
        echo "Building project..."
        "$BUN_PATH" --bun run vite build
        ;;
    preview)
        echo "Starting preview server on http://localhost:5175"
        "$BUN_PATH" --bun run vite preview --port 5175
        ;;
    install)
        echo "Installing dependencies with Bun..."
        "$BUN_PATH" install
        echo ""
        echo "Installing additional dependencies..."
        "$BUN_PATH" add three@^0.178.0 mp4box@^1.2.0 @types/three@^0.178.0
        ;;
    clean)
        echo "Cleaning project..."
        rm -rf dist
        rm -rf .svelte-kit
        rm -f bun.lock
        echo "Clean complete!"
        ;;
    deps)
        echo "Installing project dependencies..."
        "$BUN_PATH" install
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo ""
        echo "Usage: $0 [dev|build|preview|install|clean|deps]"
        echo "  dev      - Start development server"
        echo "  build    - Build for production"
        echo "  preview  - Preview production build"
        echo "  install  - Install all dependencies including Three.js"
        echo "  deps     - Install basic dependencies"
        echo "  clean    - Clean build artifacts"
        exit 1
        ;;
esac
