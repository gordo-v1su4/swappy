# Swappy - Video Editing Application

A transient-driven video editing application built with Svelte 5. Upload a master audio track and individual stems, detect transients, and automatically switch between video clips based on waveform markers with FFmpeg integration for video processing.

## Features

- **Advanced Audio Analysis**: Upload a master track and corresponding stems (e.g., vocals, drums, bass) for detailed transient detection.
- **Stem-Based Control**: Toggle individual stems to control which transients are used for video switching.
- **Video Management**: Upload multiple video clips with FFmpeg-powered thumbnail generation.
- **Marker-Based Switching**: Automatically switch videos based on detected transients from the master track and selected stems.
- **Customizable Timing**: Adjust markers per shot (1-12 markers) with a slider.
- **Save/Load Projects**: Save your project, including all stem transient data, to a JSON file and load it back later.
- **Video Position Memory**: Resume videos from where they left off when cycling back.
- **Drag & Drop Reordering**: Rearrange video sequence in reordering mode.
- **Real-time Playback**: Synchronized audio and video playback.
- **FFmpeg Integration**: Browser-based video processing and thumbnail generation.
- **Audio Visualization**: Real-time waveform visualization and analysis.
- **Export Capabilities**: Export processed videos with custom settings.

## Quick Start

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Open [http://localhost:5001](http://localhost:5001) in your browser.

## How to Use

1.  **Upload Master Track**: Click "Upload" in the "Master" section to load your main audio file.
2.  **Upload Stems**: Click "Add" in the "Stems" section to upload individual audio stems (e.g., vocals, drums).
3.  **Manage Transients**: Use the "Update Transients" button to filter and apply transients from the master and selected stems to the main timeline.
4.  **Upload Videos**: Click "Batch Upload Videos" to add video clips.
5.  **Set Marker Timing**: Use the "Markers per Shot" slider (1-12) to control video switching frequency.
6.  **Play**: Hit the play button to start synchronized playback.
7.  **Reorder Videos**: Toggle "Reorder Mode" to drag and drop video sequence.
8.  **Save/Load**: Use the "Save Transients" and "Load Transients" buttons to save and load your project state.

## Project Structure

```
src/
├── App.svelte              # Main application component
├── AudioTimeline.svelte    # Audio waveform and analysis
├── AudioVisualizer.svelte  # Real-time audio visualization
├── VideoEditor.svelte      # Video management and synchronization
├── VideoPlayer.svelte      # Main video playback component
├── Markers.svelte          # Marker visualization
├── AudioFileManager.svelte # Audio file and stem management
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
