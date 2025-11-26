# Swappy with Bun - Quick Start Guide

This project now uses **Bun** as the package manager and runtime for faster installs and better performance.

## Prerequisites

- Install Bun (if not already installed):
  ```bash
  # Windows (PowerShell)
  powershell -c "irm bun.sh/install.ps1|iex"
  
  # macOS/Linux
  curl -fsSL https://bun.sh/install | bash
  ```

- Verify Bun installation:
  ```bash
  bun --version
  ```

## Quick Start

### 1. Install Dependencies

```bash
# In the swappy directory
cd C:\Users\Gordo\Documents\Github\swappy

# Install all dependencies including Three.js and mp4box
bun install
bun add three@^0.178.0 mp4box@^1.2.0 @types/three@^0.178.0
```

Or use the helper script:
```bash
# Windows
bun-dev.bat install

# Linux/macOS/Windows with Git Bash
./bun-dev.sh install
```

### 2. Development Mode

```bash
# Start development server with hot reload
bun --bun run vite --host --port 5174

# Or use the helper script:
bun-dev.bat dev      # Windows
./bun-dev.sh dev     # Linux/macOS
```

The app will be available at: **http://localhost:5174**

### 3. Build for Production

```bash
# Build the project
bun --bun run vite build

# Or use the helper script:
bun-dev.bat build      # Windows
./bun-dev.sh build     # Linux/macOS
```

### 4. Preview Production Build

```bash
# Preview the built application
bun --bun run vite preview --port 5175

# Or use the helper script:
bun-dev.bat preview      # Windows
./bun-dev.sh preview     # Linux/macOS
```

The preview will be available at: **http://localhost:5175**

### 5. Clean Build Artifacts

```bash
# Remove dist, .svelte-kit, and lock files
bun-dev.bat clean      # Windows
./bun-dev.sh clean     # Linux/macOS
```

## Project Structure

```
swappy/
├── src/
│   ├── video/
│   │   └── ShaderVideoPlayer.svelte    # Main video shader component
│   ├── AudioAnalyzerEnhanced.svelte    # Enhanced audio analysis
│   └── VideoEditor.svelte              # Video editor interface
├── lib/
│   └── video/
│       └── video-codecs.js             # WebCodecs video processing
├── bun-dev.bat                         # Windows helper script
├── bun-dev.sh                          # Unix helper script
└── bun-workspace.json                  # Bun workspace config
```

## Available Scripts

Using Bun directly:
- `bun --bun run vite dev` - Development server
- `bun --bun run vite build` - Production build
- `bun --bun run vite preview` - Preview build

Using helper scripts:
- `bun-dev.bat install` - Install all dependencies
- `bun-dev.bat dev` - Start dev server
- `bun-dev.bat build` - Build project
- `bun-dev.bat preview` - Preview build
- `bun-dev.bat clean` - Clean artifacts

## WebCodecs Video + Shaders Integration

This project now includes:

1. **WebCodecs Video Player** - Hardware-accelerated video decoding
2. **Shader Support** - Real-time video effects using WebGL/Three.js
3. **Audio Reactivity** - Effects respond to bass, mid, and treble frequencies
4. **Beat Detection** - Automatic cuts and effects synchronized to music

### Shader Uniforms Available

When creating audio-reactive shaders, these uniforms are automatically provided:

```glsl
uniform float u_audioLevel;      // 0.0 - 1.0 (overall volume)
uniform float u_bassLevel;       // 0.0 - 1.0 (60-250 Hz)
uniform float u_midLevel;        // 0.0 - 1.0 (500-2000 Hz)
uniform float u_trebleLevel;     // 0.0 - 1.0 (6k-20k Hz)
uniform float u_time;            // Elapsed time in seconds
uniform sampler2D u_texture;     // Video frame texture
uniform vec2 u_resolution;       // Resolution
```

## Troubleshooting

### Bun not found
```bash
# Check Bun installation
~/.bun/bin/bun --version

# Or add to PATH
export PATH="$HOME/.bun/bin:$PATH"
```

### Port already in use
```bash
# Use different port
bun --bun vite --port 3000
```

### Build errors
```bash
# Clean and reinstall
bun-dev.bat clean
bun install
bun add three@^0.178.0 mp4box@^1.2.0 @types/three@^0.178.0
```

## Performance Notes

- **60fps target** - Video shaders render at 60 FPS
- **Hardware acceleration** - WebCodecs uses GPU decoding
- **Audio analysis** - Runs at 60fps but throttled for performance
- **Memory efficient** - VideoFrames are properly closed after use

## Next Steps

After setup, see `INTEGRATION_TODO.md` for integration tasks:
1. Copy shader files from svelte-video-shaders
2. Integrate ShaderVideoPlayer into VideoEditor
3. Connect audio analysis to video cuts and effects
4. Add more shader presets
5. Optimize render pipeline

## Build & Run Summary

```bash
# One-time setup
cd C:\Users\Gordo\Documents\Github\swappy
bun install
bun add three@^0.178.0 mp4box@^1.2.0 @types/three@^0.178.0

# Start developing
bun --bun run vite --host --port 5174

# Or use shortcuts
bun-dev.bat dev      # Windows
./bun-dev.sh dev     # Linux/macOS
```

Visit **http://localhost:5174** to see the app!
