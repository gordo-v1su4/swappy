# Swappy - Video Editing Application

A transient-driven video editing application built with Svelte 5. Upload audio tracks, detect transients, and automatically switch between video clips based on waveform markers with FFmpeg integration for video processing.

## Features

- **Audio Analysis**: Load audio files and analyze waveforms with marker detection
- **Video Management**: Upload multiple video clips with FFmpeg-powered thumbnail generation
- **Marker-Based Switching**: Automatically switch videos based on detected markers
- **Customizable Timing**: Adjust markers per shot (1-12 markers) with a slider
- **Video Position Memory**: Resume videos from where they left off when cycling back
- **Drag & Drop Reordering**: Rearrange video sequence in reordering mode
- **Real-time Playback**: Synchronized audio and video playback
- **FFmpeg Integration**: Browser-based video processing and thumbnail generation
- **Audio Visualization**: Real-time waveform visualization and analysis
- **Export Capabilities**: Export processed videos with custom settings

## Quick Start

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

## How to Use

1. **Upload Audio**: Click "Open Audio File" to load your music track
2. **Detect Transients**: Use "Detect Transients" to analyze the waveform and create markers
3. **Upload Videos**: Click "Batch Upload Videos" to add video clips
4. **Set Marker Timing**: Use the "Markers per Shot" slider (1-12) to control video switching frequency
5. **Play**: Hit the play button to start synchronized playback
6. **Reorder Videos**: Toggle "Reorder Mode" to drag and drop video sequence

## Project Structure

```
src/
├── App.svelte              # Main application component
├── AudioTimeline.svelte    # Audio waveform and analysis
├── AudioVisualizer.svelte  # Real-time audio visualization
├── VideoEditor.svelte      # Video management and synchronization
├── VideoPlayer.svelte      # Main video playback component
├── Markers.svelte          # Marker visualization
├── AudioFileManager.svelte # Audio file upload and management
├── ExportDialog.svelte     # Video export interface
├── ffmpegService.js        # FFmpeg service for video processing
└── main.js                 # Application entry point
```

## Technology Stack

- **Frontend**: Svelte 5.34.7 (with runes system)
- **Audio Processing**: WaveSurfer.js 7.9.5
- **Video Processing**: FFmpeg WASM (@ffmpeg/ffmpeg 0.12.15)
- **Build Tool**: Vite 6.3.5
- **Package Manager**: pnpm

## Building for Production

Create an optimized build:

```bash
pnpm run build
```

Preview the production build:

```bash
pnpm run preview
```

## Development

The application uses:
- **WaveSurfer.js** for audio waveform visualization and playback
- **FFmpeg WASM** for browser-based video processing and thumbnail generation
- **Transient detection** algorithms for automatic video switching
- **Drag & drop** API for video reordering
- **File API** for video and audio uploads
- **Svelte 5 runes** ($state, $derived, $effect) for reactive state management

## Browser Support

Modern browsers with support for:
- Web Audio API
- File API
- HTML5 Video
- ES6+ JavaScript features
- SharedArrayBuffer (required for FFmpeg WASM)
- Cross-Origin-Embedder-Policy (COEP) headers
- Cross-Origin-Opener-Policy (COOP) headers

## License

MIT License
