# Swappy - Video Editing Application

A transient-driven video editing application built with Svelte. Upload audio tracks, detect transients, and automatically switch between video clips based on waveform markers.

## Features

- **Audio Analysis**: Load audio files and analyze waveforms with marker detection
- **Video Management**: Upload multiple video clips with thumbnail grid display
- **Marker-Based Switching**: Automatically switch videos based on detected markers
- **Customizable Timing**: Adjust markers per shot (1-12 markers) with a slider
- **Video Position Memory**: Resume videos from where they left off when cycling back
- **Drag & Drop Reordering**: Rearrange video sequence in reordering mode
- **Real-time Playback**: Synchronized audio and video playback

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
├── VideoEditor.svelte      # Video management and synchronization
├── VideoPlayer.svelte      # Main video playback component
├── Markers.svelte          # Marker visualization
├── AudioFileManager.svelte # Audio file upload and management
└── main.js                 # Application entry point
```

## Technology Stack

- **Frontend**: Svelte 3
- **Audio Processing**: WaveSurfer.js
- **Build Tool**: Vite
- **Package Manager**: pnpm

## Building for Production

Create an optimized build:

```bash
pnpm run build
```

Serve the production build:

```bash
pnpm run start
```

## Development

The application uses:
- **WaveSurfer.js** for audio waveform visualization and playback
- **Beat detection** algorithms for automatic video switching
- **Drag & drop** API for video reordering
- **File API** for video and audio uploads

## Browser Support

Modern browsers with support for:
- Web Audio API
- File API
- HTML5 Video
- ES6+ JavaScript features

## License

MIT License
