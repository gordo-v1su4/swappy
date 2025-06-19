# Swappy - Audio/Video Editor

A modern web-based audio/video editor built with SvelteKit and WebAssembly.

## Prerequisites

- Node.js >= 18.13.0 (Required by SvelteKit)
- pnpm >= 8.0.0
- Modern browser with:
  - Web Audio API support
  - WebAssembly support
  - HTML5 Video support

## Quick Start

1. **Install Node.js 18.13.0 or later**
   ```bash
   # Using nvm (recommended)
   nvm install 18.13.0
   nvm use 18.13.0
   
   # Verify installation
   node --version
   ```

2. **Install pnpm**
   ```bash
   npm install -g pnpm
   ```

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

4. **Start Development Server**
   ```bash
   pnpm dev
   ```

5. **Access the Application**
   - Open http://localhost:5173 in your browser

## Features

- **Audio Processing**
  - Waveform visualization with WaveSurfer.js
  - Transient detection for precise audio analysis
  - Real-time audio manipulation
  - Volume control and audio extraction

- **Video Processing**
  - Client-side video processing with FFmpeg.wasm
  - Frame-accurate seeking
  - Thumbnail generation
  - HLS support for smooth playback

- **Modern UI**
  - Dark theme
  - Responsive design
  - Drag-and-drop file upload
  - Intuitive controls

## Project Structure

```
swappy/
├── src/                # Source code
│   ├── lib/           # Library code
│   │   ├── components/ # Reusable components
│   │   │   ├── audio/  # Audio-related components
│   │   │   └── video/  # Video-related components
│   │   └── services/   # Shared services
│   ├── routes/        # Page components
│   ├── app.html      # App template
│   └── app.css       # Global styles
├── static/           # Static assets
└── tests/           # Test files
```

## Technology Stack

The application is built with:
- SvelteKit 2.0
- Svelte 5.0 (with runes)
- Vite 5.0
- TypeScript
- WaveSurfer.js for audio visualization
- FFmpeg.wasm for video processing
- HLS.js for video playback

## Development Plan

### Phase 1: Core Infrastructure
- [x] Project setup with SvelteKit and Vite
- [x] Implementation of Svelte 5 runes
- [ ] WASM module integration
- [ ] File handling system

### Phase 2: Video Processing
- [ ] Client-side video processing with FFmpeg.wasm
- [ ] Video player component
- [ ] Thumbnail generation
- [ ] Frame extraction

### Phase 3: Audio Processing
- [ ] Audio visualization
- [ ] Waveform display
- [ ] Transient detection
- [ ] Volume control

### Phase 4: UI/UX
- [ ] Dark theme implementation
- [ ] Responsive layout
- [ ] Drag-and-drop interface
- [ ] Progress indicators

## Troubleshooting

### Common Issues

1. **Node.js Version Error**
   ```
   ERR_PNPM_UNSUPPORTED_ENGINE Unsupported environment
   ```
   Solution: Install Node.js 18.13.0 or later using nvm

2. **Port Already in Use**
   ```
   error: Address already in use
   ```
   Solution: Kill the process using the port:
   ```bash
   sudo lsof -i :5173
   kill -9 <PID>
   ```

3. **WASM Loading Issues**
   If you encounter issues with WASM modules:
   - Check if your browser supports WebAssembly
   - Ensure you're using HTTPS in production
   - Clear browser cache and reload

## License

MIT License - See LICENSE file for details
