# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Please also read all the files in .cursor/rules/

## Project Overview

Swappy is a Svelte 5-based video editing application that uses transient detection to automatically switch between video clips based on audio markers. The project follows a modern Svelte architecture with FFmpeg WASM integration for video processing. The application supports uploading a master audio track and individual stems (e.g., vocals, drums, bass) for fine-grained transient control.

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
- `AudioFileManager.svelte` - Audio file and stem management, including transient analysis.
- `AudioTimeline.svelte` - Waveform visualization and transient filtering.
- `AudioVisualizer.svelte` - Real-time audio visualization
- `Markers.svelte` - Marker visualization and interaction

**Video Processing Components:**
- `VideoEditor.svelte` - Video management and synchronization logic
- `VideoPlayer.svelte` - Main video playback component
- `ExportDialog.svelte` - Video export interface and settings

**Services and Utilities:**
- `ffmpegService.js` - FFmpeg WASM integration for video processing

## Key Features

### Audio Analysis & Processing
- **Stem-based Workflow**: Upload a master audio track and individual stems.
- **Automatic Transient Detection**: Each uploaded audio file (master and stems) is automatically analyzed to detect transients.
- **Transient Filtering**: A dedicated UI allows for filtering the combined transients from the master and stems based on density, randomness, and other parameters.
- **Save/Load Projects**: Project state, including all transient data, can be saved to a JSON file and loaded back into the application.
- **Real-time Waveform Visualization**: Uses WaveSurfer.js for waveform display.
- **Audio Playback Synchronization**: The master audio track is synchronized with the video playback.

### Video Management & Processing
- Multiple video clip upload and management
- FFmpeg WASM integration for thumbnail generation
- Video switching synchronized to the filtered audio markers
- Drag & drop video reordering functionality
- Video export capabilities with custom settings

## Technical Architecture

### State Management Patterns
- The application uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactive state management.
- State is managed in the `App.svelte` component and passed down to child components via props.
- Child components emit events to notify the parent of state changes.
- To prevent infinite loops, state updates are performed immutably, especially for arrays and objects. For example, instead of `myArray.push(newItem)`, use `myArray = [...myArray, newItem]`.

### Component Architecture
- **`AudioFileManager.svelte`**: Manages all audio files, including the master track and stems. It is responsible for uploading, analyzing, and storing transient data for each file. It emits events to notify the rest of the application of changes to the audio files and their transients.
- **`AudioTimeline.svelte`**: Receives transient data from `AudioFileManager.svelte` via `App.svelte`. It displays the waveform of the master track and provides UI controls for filtering the combined transients. It does not perform any transient detection itself.
- **`App.svelte`**: The central hub of the application. It manages the overall state and facilitates communication between the `AudioFileManager` and `AudioTimeline` components.

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