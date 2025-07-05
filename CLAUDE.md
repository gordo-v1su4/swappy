# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Swappy is a Svelte 5-based video editing application that uses transient detection to automatically switch between video clips based on audio markers. The project follows a modern Svelte architecture with FFmpeg WASM integration for video processing.

## Project Structure

### Root Directory Organization
```
swappy/
├── .cursor/rules/          # Cursor IDE configuration and documentation
├── public/                 # Static assets served by Vite
├── src/                    # Main application source code
├── index.html              # Entry HTML file (Vite)
├── package.json            # Project dependencies and scripts
├── vite.config.js          # Vite build configuration
├── README.md               # Project documentation
└── CLAUDE.md               # This file
```

### Source Code Organization (`src/`)

**Core Application Files:**
- `App.svelte` - Main application component and entry point
- `main.js` - Application bootstrap and initialization

**Audio Processing Components:**
- `AudioFileManager.svelte` - Audio file upload and management
- `AudioTimeline.svelte` - Waveform visualization and transient detection
- `AudioVisualizer.svelte` - Real-time audio visualization
- `Markers.svelte` - Marker visualization and interaction

**Video Processing Components:**
- `VideoEditor.svelte` - Video management and synchronization logic
- `VideoPlayer.svelte` - Main video playback component
- `ExportDialog.svelte` - Video export interface and settings

**Services and Utilities:**
- `ffmpegService.js` - FFmpeg WASM integration for video processing

## Technology Stack

### Core Framework
- **Svelte 5.34.7** - Modern reactive framework with runes system (`$state`, `$derived`, `$effect`)
- **Vite 6.3.5** - Fast build tool and dev server with ES modules
- **@sveltejs/vite-plugin-svelte 5.1.0** - Seamless Svelte + Vite integration

### Audio Processing
- **WaveSurfer.js 7.9.5** - Audio waveform visualization and analysis library
  - Real-time waveform rendering
  - Audio playback control
  - Marker and region management
  - Transient detection algorithms

### Video Processing
- **@ffmpeg/ffmpeg 0.12.15** - WebAssembly port of FFmpeg for browser-based video processing
- **@ffmpeg/util 0.12.2** - FFmpeg utilities for file handling and memory management

### Package Manager
- **pnpm** - Used for dependency management with faster installs and disk efficiency

## Development Commands

```bash
# Development server (port 5000)
pnpm run dev

# Production build
pnpm run build

# Preview production build
pnpm run preview
```

## Key Features

### Audio Analysis & Processing
- Audio file upload and management
- Real-time waveform visualization with WaveSurfer.js
- Transient detection for automatic marker generation
- Audio playback synchronization with video

### Video Management & Processing
- Multiple video clip upload and management
- FFmpeg WASM integration for thumbnail generation
- Video switching synchronized to audio markers
- Drag & drop video reordering functionality
- Video export capabilities with custom settings

### State Management
- Svelte 5 runes system for reactive state management
- Component-based architecture with props and events
- Optimized reactivity with compile-time optimizations

## Technical Architecture

### State Management Patterns
```javascript
// ✅ Use Svelte 5 runes for reactive state
let count = $state(0);
let doubled = $derived(count * 2);
$effect(() => console.log('Count changed:', count));
```

### Component Architecture
- Group related components together
- Separate concerns: audio processing, video processing, UI components
- Keep services and utilities separate from components
- Use descriptive PascalCase naming for Svelte components

### Import Patterns
```javascript
// ✅ Good: Clear, specific imports
import VideoPlayer from './VideoPlayer.svelte';
import { processVideo } from './ffmpegService.js';
```

## Browser Requirements

The application requires modern browsers with support for:
- **Web Audio API** - For audio processing and analysis
- **File API** - For file uploads and handling
- **HTML5 Video** - For video playback
- **SharedArrayBuffer** - For FFmpeg WASM performance
- **ES6+ Features** - Arrow functions, destructuring, modules

### Required Security Headers
```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### Browser Support Matrix
- **Chrome**: 88+ (with SharedArrayBuffer support)
- **Firefox**: 79+ (with SharedArrayBuffer support)
- **Safari**: 15+ (with SharedArrayBuffer support)
- **Edge**: 88+ (with SharedArrayBuffer support)

## Development Guidelines

### File Naming Conventions
- **Svelte Components**: PascalCase (`VideoPlayer.svelte`)
- **JavaScript Files**: camelCase (`ffmpegService.js`)
- **Configuration Files**: kebab-case (`vite.config.js`)
- **CSS Files**: kebab-case (`global.css`)

### Memory Management
```javascript
// ✅ Good: Proper cleanup of audio/video resources
$effect(() => {
  if (audioFile) {
    wavesurfer.load(audioFile);
    return () => {
      wavesurfer.destroy(); // Cleanup on unmount
    };
  }
});
```

### Security Considerations
```javascript
// ✅ Good: Validate file types and sizes
const validateFile = (file) => {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const allowedTypes = ['video/mp4', 'audio/mp3', 'audio/wav'];
  
  return file.size <= maxSize && allowedTypes.includes(file.type);
};
```

## Performance Optimization

### Bundle Size Management
- **Svelte**: Tree-shaking friendly, small runtime
- **Vite**: Automatic code splitting and optimization
- **WaveSurfer.js**: Modular imports for specific features
- **FFmpeg**: Load only required codecs and features

### Video Processing
- Large video files are processed in chunks via FFmpeg WASM
- Video thumbnails are generated on-demand
- Multiple CDN fallback strategies for FFmpeg loading
- Unique file naming to prevent conflicts in concurrent operations

### Audio Processing
- Audio analysis uses Web Audio API for real-time processing
- Waveform visualization optimized for performance
- Transient detection algorithms for automatic marker generation

## Video Synchronization

Swappy implements marker-based video switching where:
- Audio markers are detected via transient analysis using WaveSurfer.js
- Videos switch at marker positions based on "markers per shot" configuration
- Video position memory allows resuming from previous playback position
- Drag & drop reordering mode for manual sequence adjustment

## Cursor Rules Integration

This project includes comprehensive cursor rules for development guidance:
- **project-structure.mdc** - Directory structure and file organization
- **technology-stack.mdc** - Dependencies, versions, and best practices
- **cursor-rules.mdc** - How to manage cursor rules
- **self-improve.mdc** - Rule improvement and maintenance

## Future Considerations

### Potential Upgrades
- **Svelte 6**: When available, evaluate runes improvements
- **Vite 7**: For future build optimizations
- **WaveSurfer 8**: For enhanced audio features
- **FFmpeg 0.13+**: For new codec support

### Migration Notes
- Monitor breaking changes in major version updates
- Test updates in development environment first
- Update cursor rules when patterns evolve