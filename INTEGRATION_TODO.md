# Swappy Video Integration & Audio Reactivity Enhancement

## Phase 1: WebCodecs Video Integration
- [ ] **Copy WebCodecs video processing from svelte-video-shaders**
  - [ ] Add mp4box dependency to package.json
  - [ ] Create video-utils.js with WebCodecs decoder
  - [ ] Create VideoCodecsPlayer.svelte component
  - [ ] Add VideoFrame to WebGL texture upload functionality
  - [ ] Integrate Three.js renderer with video frames

- [ ] **Update Swappy package.json dependencies**
  ```json
  {
    "mp4box": "^1.2.0",
    "three": "^0.178.0",
    "@types/three": "^0.178.0",
    "@types/node": "^22"
  }
  ```

## Phase 2: Shader System Integration
- [ ] **Copy shader files from svelte-video-shaders**
  - [ ] Copy vhs-shader.js
  - [ ] Copy xlsczn-shader.js (audio reactive)
  - [ ] Create shader library/index
  - [ ] Add more shader presets (Glitch, Bloom, CRT, etc.)

- [ ] **Create ShaderVideoPlayer.svelte**
  - [ ] Combine VideoCodecsPlayer with shader rendering
  - [ ] Support uniform parameter updates
  - [ ] Audio reactive uniform binding

## Phase 3: Audio Reactivity Enhancement
- [ ] **Improve AudioAnalyzer in Swappy**
  - [ ] Add beat detection algorithm
  - [ ] Add transient detection for cuts
  - [ ] Add frequency band isolation (bass, mid, treble with better ranges)
  - [ ] Onset detection for effect triggers
  - [ ] BPM detection for synced effects

- [ ] **Audio Reactive Features**
  - [ ] Shader parameters react to audio data
  - [ ] Automatic video cuts on beats/transients
  - [ ] Audio-reactive transitions between clips
  - [ ] Dynamic effect intensity based on audio levels

## Phase 4: UI/UX Integration
- [ ] **Update VideoEditor.svelte**
  - [ ] Replace video elements with ShaderVideoPlayer
  - [ ] Add shader preset selector to each video clip
  - [ ] Add audio-reactive toggle per clip
  - [ ] Real-time parameter controls

- [ ] **Audio Timeline Integration**
  - [ ] Visualize beat markers on timeline
  - [ ] Show transient/attack points
  - [ ] Sync video cuts to audio features

## Phase 5: Performance Optimization
- [ ] **Optimize WebCodecs pipeline**
  - [ ] Frame queue management
  - [ ] Hardware acceleration verification
  - [ ] Memory management for VideoFrames
  - [ ] Efficient texture uploads

- [ ] **Optimize shader rendering**
  - [ ] Minimize uniform updates
  - [ ] Texture caching
  - [ ] Render loop optimization
  - [ ] FPS target: 60fps minimum

- [ ] **Optimize audio analysis**
  - [ ] Efficient FFT processing
  - [ ] Throttle analysis updates (avoid per-frame)
  - [ ] Web Worker for heavy calculations

## Phase 6: Advanced Features
- [ ] **Beat-synced Effects**
  - [ ] Effects trigger on beat with customizable patterns
  - [ ] Multiple effect layers per clip
  - [ ] Effect sequencing

- [ ] **MIDI/OSC Control**
  - [ ] External control of effects
  - [ ] Live performance mode

- [ ] **Export with Effects**
  - [ ] Render video with applied shaders
  - [ ] Combine with existing FFmpeg export

## Phase 7: Testing & Polish
- [ ] **Cross-browser testing**
  - [ ] Chrome/Edge WebCodecs compatibility
  - [ ] Performance profiling
  - [ ] Memory leak testing

- [ ] **Shader preset library**
  - [ ] 15+ working presets
  - [ ] Proper parameter ranges
  - [ ] Documentation

## Implementation Priority
1. **High Priority**: Get WebCodecs video working in Swappy
2. **High Priority**: Basic audio reactivity for at least 2-3 shaders
3. **Medium Priority**: Shader preset system working reliably
4. **Medium Priority**: Beat detection and automatic cuts
5. **Low Priority**: Advanced features and polish
