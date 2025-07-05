# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This repository contains two main applications:

### 1. Swappy (Root Directory)
A Svelte 5-based video editing application with transient-driven video switching capabilities using the latest runes system.

**Key Features:**
- Audio waveform analysis with transient detection
- Video switching synchronized to audio markers
- FFmpeg integration for video processing and thumbnail generation
- Drag & drop video reordering functionality

**Core Components:**
- `src/App.svelte` - Main application component coordinating audio and video
- `src/AudioTimeline.svelte` - Audio waveform visualization and marker detection
- `src/VideoEditor.svelte` - Video management and synchronization logic
- `src/ffmpegService.js` - FFmpeg service for video processing operations

**Key Features:**
- Real-time audio visualization with Web Audio API
- Canvas-based editing with FabricJS integration
- Video export using WebAV (WebCodecs API)
- Zustand for state management

**Architecture:**
- `src/App.tsx` - Main React app with TDesign UI components
- `src/stores/` - Zustand stores for audio, canvas, and settings state
- `src/visualizers/` - Audio analysis and visualization effects system
- `src/components/` - UI components organized by domain (audio, base, layout)

## Development Commands

### Swappy (Root)
```bash
# Development server (port 5000)
pnpm run dev

# Production build
pnpm run build

# Preview production build
pnpm run preview

# Development server
pnpm run dev

# Production build with TypeScript compilation
pnpm run build

# Code formatting
pnpm run lint
```

## Technical Architecture

### Audio Processing
- **Swappy**: Uses WaveSurfer.js for waveform visualization and beat detection

### Video Processing
- **Swappy**: FFmpeg WASM integration for thumbnail generation and video processing
  - Multiple CDN fallback strategies for FFmpeg loading
  - Unique file naming to prevent conflicts in concurrent operations

### State Management
- **Swappy**: Svelte 5 runes ($state, $derived, $effect, $props, $bindable) with reactive patterns

### UI Framework Integration
- **Swappy**: Pure Svelte with custom CSS styling

## Key Dependencies

### Swappy
- `@ffmpeg/ffmpeg` - Video processing in the browser
- `wavesurfer.js` - Audio waveform visualization
- `svelte@5.34.7` + `vite@6.3.5` - Build system with latest Svelte 5 runes

## Development Notes

### Cross-Origin Headers
Swappy's Vite config includes COOP/COEP headers required for FFmpeg WASM and SharedArrayBuffer support.

### Audio Analysis
The `FrequencyAnalyzer` class implements:
- Hann windowing to reduce spectral leakage
- FFT transformation from time to frequency domain
- Logarithmic magnitude calculation with smoothing
- Customizable frequency shaping algorithms

### Video Synchronization
Swappy implements marker-based video switching where:
- Audio markers are detected via transient analysis
- Videos switch at marker positions based on "markers per shot" configuration
- Video position memory allows resuming from previous playback position