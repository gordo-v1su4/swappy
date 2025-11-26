# Swappy v0.1

**Audio-reactive video editor with WebCodecs video playback, shader effects, and Svelte 5 runes.**

Combining smooth video playback from svelte-video-shaders with Swappy's audio analysis and editing features. Work in progress integrating hardware-accelerated video decoding with real-time shader effects.

## Quick Start (Bun)

### 1. Install Dependencies

```bash
cd C:\Users\Gordo\Documents\Github\swappy

# Install all dependencies with Bun
bun install

# Install video shader dependencies
bun add three@^0.178.0 mp4box@^1.2.0 @types/three@^0.178.0
```

### 2. Run Development Server

```bash
# Option A: Use helper script
./bun-dev.sh dev      # Linux/macOS
bun-dev.bat dev       # Windows

# Option B: Direct Bun command
bun --bun run vite --host --port 5174
```

The app will be at: **http://localhost:5174**

### 3. Build & Preview

```bash
# Build for production
bun --bun run vite build

# Preview production build
./bun-dev.sh preview  # or: bun --bun run vite preview --port 5175
```

## Available Commands

| Command | Description | Script |
|---------|-------------|--------|
| `bun --bun run vite` | Start dev server | `bun-dev.sh dev` |
| `bun --bun run vite build` | Build for production | `bun-dev.sh build` |
| `bun --bun run vite preview` | Preview build | `bun-dev.sh preview` |
| `bun install` | Install dependencies | - |
| `bun add <pkg>` | Add package | - |

## Project Status

### ✅ Working Features

- Audio file upload and playback
- Waveform visualization
- Audio analysis (frequency bands, beat detection)
- Basic video trimming interface
- FFmpeg export functionality

### 🔄 In Progress (Integration Phase)

- WebCodecs video decoder components created
- Shader video player component created
- Audio analyzer enhanced with beat detection
- **Not yet integrated into UI**

### 📦 Components Created

```
src/
├── video/
│   └── ShaderVideoPlayer.svelte    # WebCodecs + Three.js shader player
├── AudioAnalyzerEnhanced.svelte    # Enhanced audio analysis
├── VideoEditor.svelte              # Main video editor
└── *(existing Swappy components)*

lib/
└── video/
    └── video-codecs.js             # WebCodecs video processing
```

### 🎯 Next: Integration Tasks

See `INTEGRATION_TODO.md` for detailed plan.

## Prerequisites

- **Bun** package manager (faster than npm)
- **Chrome 94+** or **Edge 94+** (WebCodecs API required)

### Install Bun

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Verify
bun --version
```

## Tech Stack

- **Svelte 5** - Modern reactive framework with runes
- **Vite** - Fast build tooling
- **Bun** - Package manager & runtime
- **WebCodecs API** - Hardware video decoding
- **Three.js** - WebGL shader rendering
- **wavesurfer.js** - Audio waveform visualization
- **FFmpeg.wasm** - Video/audio processing

## Browser Requirements

- ✅ Chrome 94+ (Recommended)
- ✅ Edge 94+
- ❌ Firefox (WebCodecs not stable)
- ❌ Safari (WebCodecs not implemented)

## Troubleshooting

### "bun command not found"

Add Bun to PATH:
```bash
# Windows
set PATH=C:\Users\Gordo\.bun\bin;%PATH%

# Or use full path:
C:\Users\Gordo\.bun\bin\bun.exe --version
```

### "Port already in use"

Use different port:
```bash
bun --bun run vite --port 3000
```

### "Module not found" errors

Reinstall dependencies:
```bash
rm -rf node_modules bun.lock
bun install
```

## File Structure

```
Swappy/
├── src/
│   ├── lib/                 # Utils, video codecs, audio
│   ├── routes/              # Page components
│   ├── stories/             # Storybook stories
│   ├── video/               # Video shader player (NEW)
│   ├── AudioTimeline.svelte # Audio editor
│   ├── VideoEditor.svelte   # Video editor
│   └── App.svelte           # Main app
├── public/                  # Static assets
├── lib/                     # Library code
│   └── video/
│       └── video-codecs.js  # WebCodecs video (NEW)
├── bun-workspace.json       # Bun configuration
├── bun-dev.sh               # Unix helper script
├── bun-dev.bat              # Windows helper script
├── BUN_SETUP.md             # Bun setup guide
├── INTEGRATION_TODO.md      # Integration plan
└── package.json
```

## Development

### Current Branch

This is the **video-shader-integration** branch. The video shader system is being integrated into Swappy's existing audio editor.

### Related Projects

- **svelte-video-shaders** - Reference video shader project with working WebCodecs implementation
- Both projects use Svelte 5 and share components during integration

### Running Both Projects

```bash
# Terminal 1: svelte-video-shaders (reference)
cd C:\Users\Gordo\Documents\Github\svelte-video-shaders
bun run dev
# → http://localhost:5173

# Terminal 2: swappy (integration target)
cd C:\Users\Gordo\Documents\Github\swappy
bun --bun run vite --port 5174
# → http://localhost:5174
```

## License

MIT
