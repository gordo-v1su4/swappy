# Swappy - Audio/Video Editor

A modern web-based audio/video editor built with SvelteKit and Rust.

## Prerequisites

- Node.js >= 18.13.0 (Required by SvelteKit)
- pnpm >= 8.0.0
- Rust >= 1.75.0
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
   # Install frontend dependencies
   cd frontend
   pnpm install
   
   # Install backend dependencies
   cd ../backend
   cargo build
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1: Start frontend
   cd frontend
   pnpm run dev
   
   # Terminal 2: Start backend
   cd backend
   cargo run
   ```

5. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

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
├── frontend/                # SvelteKit frontend application
│   ├── src/
│   │   ├── lib/            # Library code
│   │   │   ├── components/ # Reusable components
│   │   │   └── services/   # Shared services
│   │   ├── routes/         # Page components
│   │   ├── app.html       # App template
│   │   └── app.css        # Global styles
│   └── static/            # Static assets
└── backend/               # Rust backend service
    ├── src/
    │   ├── api/          # API endpoints
    │   ├── models/       # Data models
    │   ├── services/     # Business logic
    │   └── utils/        # Helper functions
    └── uploads/          # File storage
```

## Development

### Frontend Development

The frontend is built with:
- SvelteKit 2.0
- Svelte 5.0 (with runes)
- Vite 5.0
- TypeScript
- WaveSurfer.js for audio visualization
- FFmpeg.wasm for video processing
- HLS.js for video playback

### Backend Development

The backend is built with:
- Rust
- Actix-web for the HTTP server
- SQLite for data storage
- FFmpeg for server-side video processing

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
   sudo lsof -i :5173  # For frontend
   sudo lsof -i :3000  # For backend
   kill -9 <PID>
   ```

## License

MIT License - See LICENSE file for details
