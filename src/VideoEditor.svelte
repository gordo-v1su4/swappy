<script>
  import { onMount, onDestroy } from 'svelte';
  import VideoPlayer from './VideoPlayer.svelte';
  import Markers from './Markers.svelte';
  import ffmpegService from './ffmpegService.js';

  export let audioUrl = '';


  
  // Video management state
  let videos = [];
  let currentVideoIndex = 0;
  let currentVideo = null;
  let savedPositions = {};
  
  // Audio synchronization - these will be passed from parent
  export let isPlaying = false;
  export let currentTime = 0;
  export let duration = 0;
  let markers = [];
  let markersPerShot = 4; // Default value from task list
  let lastMarkerIndex = -1;
  let markerCount = 0;
  
  // UI state
  let isReorderingMode = false;
  let draggedIndex = null;
  let insertionIndex = null;
  let showInsertionInterface = false;
  let ffmpegLoaded = false;
  let ffmpegLoading = false;

  // File input reference
  let videoFileInput;
  
  $: currentVideo = videos.length > 0 ? videos[currentVideoIndex] : null;
  
  // Load beat markers from external source (placeholder for now)
  onMount(() => {
    loadMarkers();
    console.log('🎬 VideoEditor component mounted');

    // Don't initialize FFmpeg immediately - wait for user action
    // This avoids blocking the UI on startup
  });

  async function initializeFFmpeg() {
    try {
      ffmpegLoading = true;
      console.log('🔄 Initializing FFmpeg WASM...');
      await ffmpegService.load();
      ffmpegLoaded = true;
      console.log('✅ FFmpeg initialized successfully');

      // Set up logging for FFmpeg operations
      ffmpegService.setLogCallback(({ type, message }) => {
        if (type === 'error') {
          console.error('FFmpeg Error:', message);
        } else {
          console.log('FFmpeg:', message);
        }
      });

    } catch (error) {
      console.error('❌ Failed to initialize FFmpeg:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } finally {
      ffmpegLoading = false;
    }
  }
  
  onDestroy(() => {
    // Clean up object URLs
    videos.forEach(video => {
      if (video.url.startsWith('blob:')) {
        URL.revokeObjectURL(video.url);
      }
    });
  });
  
  // No need to load audio - we sync with parent AudioTimeline
  
  // Watch for audio time changes and handle marker-driven switching
  $: if (isPlaying && markers.length > 0) {
    checkMarkerSwitching(currentTime);
  }
  
  // Audio sync is handled by parent AudioTimeline component
  
  // Placeholder function to load markers from external source
  function loadMarkers() {
    // In a real implementation, this would load from various sources
    // For now, generate some sample markers for testing
    markers = [
      0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
      5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0
    ];
  }
  
  function checkMarkerSwitching(time) {
    // Find the current marker index
    const currentMarkerIndex = markers.findIndex(marker => marker > time) - 1;

    if (currentMarkerIndex !== lastMarkerIndex && currentMarkerIndex >= 0) {
      markerCount++;
      lastMarkerIndex = currentMarkerIndex;

      console.log(`🎯 Marker hit #${markerCount} at ${time.toFixed(2)}s (marker index: ${currentMarkerIndex})`);

      // Switch video every markersPerShot markers
      if (markerCount >= markersPerShot && videos.length > 1) {
        console.log(`🔄 Switching video after ${markersPerShot} markers`);
        switchToNextVideo();
        markerCount = 0;
      }
    }
  }
  
  function switchToNextVideo() {
    if (videos.length === 0) {
      console.warn('⚠️ Cannot switch video - no videos loaded');
      return;
    }

    const previousIndex = currentVideoIndex;
    const previousVideo = currentVideo;

    // Save current video position
    if (currentVideo) {
      savedPositions[currentVideo.id] = currentTime;
      console.log(`💾 Saved position ${currentTime.toFixed(2)}s for video: ${currentVideo.name}`);
    }

    // Move to next video in sequence
    currentVideoIndex = (currentVideoIndex + 1) % videos.length;
    const newVideo = videos[currentVideoIndex];

    console.log(`🎬 Switched from video ${previousIndex + 1} (${previousVideo?.name || 'none'}) to video ${currentVideoIndex + 1} (${newVideo?.name || 'none'})`);

    // Log if we have a saved position for the new video
    if (newVideo && savedPositions[newVideo.id] !== undefined) {
      console.log(`⏰ Will resume video from saved position: ${savedPositions[newVideo.id].toFixed(2)}s`);
    }
  }
  
  // Video upload handling
  async function handleVideoUpload() {
    // Open file picker immediately, don't wait for FFmpeg
    videoFileInput.click();
  }
  
  async function handleVideoFiles(event) {
    console.log('📁 Processing video file upload...');
    const files = Array.from(event.target.files);
    console.log(`📊 ${files.length} files selected`);

    for (const file of files) {
      if (file.type.startsWith('video/')) {
        console.log(`🎬 Processing video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        const video = {
          id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url: URL.createObjectURL(file), // Create URL immediately for instant playback
          file: file,
          thumbnailUrl: null,
          loaded: true, // Mark as loaded immediately
          processing: false // No processing needed for basic playback
        };

        // Add video to list immediately - ready for playback
        videos = [...videos, video];
        console.log(`✅ Video ready for playback: ${video.name}`);

        // Generate thumbnail in background (optional, non-blocking)
        generateThumbnailInBackground(video);
      } else {
        console.warn(`⚠️ Skipping non-video file: ${file.name} (${file.type})`);
      }
    }

    // Reset file input
    event.target.value = '';
    console.log('📁 Video file processing complete - all videos ready for playback');
  }

  // Generate thumbnails in background without blocking video playback
  async function generateThumbnailInBackground(video) {
    try {
      // Initialize FFmpeg only when we need thumbnails
      if (!ffmpegLoaded && !ffmpegLoading) {
        console.log('🔄 Initializing FFmpeg for thumbnail generation...');
        await initializeFFmpeg();
      }

      // Wait for FFmpeg if it's loading
      if (ffmpegLoading) {
        console.log('⏳ Waiting for FFmpeg to load for thumbnail generation...');
        while (ffmpegLoading) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (!ffmpegLoaded) {
        console.warn('⚠️ FFmpeg not available, skipping thumbnail generation');
        return;
      }

      console.log(`🖼️ Generating thumbnail for: ${video.name}`);
      const thumbnailUrl = await ffmpegService.generateThumbnail(video.file, 1);
      console.log(`✅ Thumbnail generated successfully for: ${video.name}`);

      // Update video with thumbnail
      videos = videos.map(v =>
        v.id === video.id
          ? { ...v, thumbnailUrl }
          : v
      );
    } catch (error) {
      console.warn(`⚠️ Thumbnail generation failed for ${video.name}:`, error.message);
      // Don't show error to user - thumbnails are optional
    }
  }


  
  // Video grid management
  function deleteVideo(index) {
    const video = videos[index];
    if (video.url.startsWith('blob:')) {
      URL.revokeObjectURL(video.url);
    }
    
    videos = videos.filter((_, i) => i !== index);
    
    // Adjust current video index if necessary
    if (currentVideoIndex >= videos.length) {
      currentVideoIndex = Math.max(0, videos.length - 1);
    }
  }
  
  function toggleReorderingMode() {
    isReorderingMode = !isReorderingMode;
    if (!isReorderingMode) {
      draggedIndex = null;
      insertionIndex = null;
      showInsertionInterface = false;
    }
  }
  
  // Drag and drop functionality
  function handleDragStart(event, index) {
    if (!isReorderingMode) return;
    draggedIndex = index;
    event.dataTransfer.effectAllowed = 'move';
  }
  
  function handleDragOver(event) {
    if (!isReorderingMode || draggedIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
  
  function handleDrop(event, targetIndex) {
    if (!isReorderingMode || draggedIndex === null) return;
    event.preventDefault();
    
    const draggedVideo = videos[draggedIndex];
    const newVideos = [...videos];
    
    // Remove dragged video
    newVideos.splice(draggedIndex, 1);
    
    // Insert at new position
    const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    newVideos.splice(insertIndex, 0, draggedVideo);
    
    videos = newVideos;
    
    // Update current video index if necessary
    if (draggedIndex === currentVideoIndex) {
      currentVideoIndex = insertIndex;
    } else if (draggedIndex < currentVideoIndex && insertIndex >= currentVideoIndex) {
      currentVideoIndex--;
    } else if (draggedIndex > currentVideoIndex && insertIndex <= currentVideoIndex) {
      currentVideoIndex++;
    }
    
    draggedIndex = null;
  }
  
  function handleInsertionClick(index) {
    if (!isReorderingMode) return;
    insertionIndex = index;
    showInsertionInterface = true;
  }
  
  async function handleInsertionVideoSelect(event) {
    const files = Array.from(event.target.files);

    for (const file of files) {
      if (file.type.startsWith('video/')) {
        const video = {
          id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url: null,
          file: file,
          thumbnailUrl: null,
          loaded: false,
          processing: true
        };

        // Insert at specific position
        const newVideos = [...videos];
        newVideos.splice(insertionIndex, 0, video);
        videos = newVideos;

        // Adjust current video index if necessary
        if (insertionIndex <= currentVideoIndex) {
          currentVideoIndex++;
        }

        // Generate thumbnail using FFmpeg asynchronously
        try {
          const thumbnailUrl = await ffmpegService.generateThumbnail(file, 1);

          // Update video with thumbnail
          videos = videos.map(v =>
            v.id === video.id
              ? { ...v, thumbnailUrl, loaded: true, processing: false }
              : v
          );
        } catch (error) {
          console.error('Error generating thumbnail for', file.name, ':', error);

          // Mark as loaded even if thumbnail generation failed
          videos = videos.map(v =>
            v.id === video.id
              ? { ...v, loaded: true, processing: false }
              : v
          );
        }
      }
    }

    showInsertionInterface = false;
    insertionIndex = null;
    event.target.value = '';
  }
  
  function handleVideoPositionSave(event) {
    const { id, position } = event.detail;
    savedPositions[id] = position;
    console.log(`💾 Video position saved: ${position.toFixed(2)}s for video ID: ${id}`);
  }

  // Test function to verify everything is working
  function runSystemTest() {
    console.log('🧪 Running system test...');
    console.log('📊 System Status:');
    console.log(`  - FFmpeg Loaded: ${ffmpegLoaded}`);
    console.log(`  - FFmpeg Loading: ${ffmpegLoading}`);
    console.log(`  - Videos Loaded: ${videos.length}`);
    console.log(`  - Current Video Index: ${currentVideoIndex}`);
    console.log(`  - Audio URL: ${audioUrl || 'None'}`);
    console.log(`  - Audio Duration: ${duration.toFixed(2)}s`);
    console.log(`  - Current Time: ${currentTime.toFixed(2)}s`);
    console.log(`  - Is Playing: ${isPlaying}`);
    console.log(`  - Markers: ${markers.length}`);
    console.log(`  - Markers Per Shot: ${markersPerShot}`);
    console.log(`  - Marker Count: ${markerCount}`);
    console.log(`  - Saved Positions:`, savedPositions);

    if (videos.length > 0) {
      console.log('🎬 Video Details:');
      videos.forEach((video, index) => {
        console.log(`  ${index + 1}. ${video.name} - Loaded: ${video.loaded}, Processing: ${video.processing || false}`);
      });
    }

    console.log('✅ System test complete');
  }
  
  // Audio playback is controlled by parent AudioTimeline
</script>

<div class="video-editor">
  <div class="editor-header">
    <h2>Video Editor</h2>

    <!-- FFmpeg Status Indicator -->
    <div class="ffmpeg-status">
      {#if ffmpegLoading}
        <span class="status-loading">🔄 Loading FFmpeg...</span>
      {:else if ffmpegLoaded}
        <span class="status-ready">✅ FFmpeg Ready</span>
      {:else}
        <span class="status-error">❌ FFmpeg Failed</span>
      {/if}
    </div>
  </div>

  <!-- Audio sync handled by parent AudioTimeline -->

  <!-- Controls Section -->
  <div class="controls-section">
    <div class="sync-status">
      <span class="status-label">Sync Status:</span>
      <span class="time-display">
        {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} /
        {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
      </span>
      <span class="play-status {isPlaying ? 'playing' : 'paused'}">
        {isPlaying ? '▶️ Playing' : '⏸️ Paused'}
      </span>

      <!-- FFmpeg Status -->
      <span class="ffmpeg-status">
        {#if ffmpegLoading}
          🔄 FFmpeg Loading...
        {:else if ffmpegLoaded}
          ✅ FFmpeg Ready
        {:else}
          ⏳ FFmpeg Pending
        {/if}
      </span>
    </div>
    
    <!-- MarkersPerShot Slider -->
    <div class="markers-control">
      <label for="markers-slider">Markers per Shot: {markersPerShot}</label>
      <input
        id="markers-slider"
        type="range"
        min="1"
        max="12"
        bind:value={markersPerShot}
        class="slider"
      />
    </div>
    
    <!-- Video Upload Button -->
    <button
      class="btn secondary"
      on:click={handleVideoUpload}
    >
      📁 Batch Upload Videos
      {#if ffmpegLoading}
        <span class="loading-indicator">🔄</span>
      {/if}
    </button>
    
    <!-- Reordering Mode Toggle -->
    <button
      class="btn {isReorderingMode ? 'active' : 'secondary'}"
      on:click={toggleReorderingMode}
    >
      {isReorderingMode ? 'Exit Reorder Mode' : 'Reorder Mode'}
    </button>

    <!-- System Test Button -->
    <button
      class="btn secondary"
      on:click={runSystemTest}
      title="Run system diagnostics and log status to console"
    >
      🧪 Test System
    </button>
  </div>
  
  <!-- Hidden file inputs -->
  <input
    bind:this={videoFileInput}
    type="file"
    accept="video/*"
    multiple
    style="display: none;"
    on:change={handleVideoFiles}
  />
  
  <!-- Main Video Player -->
  <VideoPlayer
    currentVideo={currentVideo ? {...currentVideo, url: currentVideo ? getVideoUrl(currentVideo) : null} : null}
    playing={isPlaying}
    {savedPositions}
    on:saveposition={handleVideoPositionSave}
  />
  
  <!-- Markers Display -->
  <Markers
    markers={markers}
    {currentTime}
    {duration}
    playing={isPlaying}
  />

  <!-- Video Grid -->
  <div class="video-grid-section">
    <h3>Video Clips</h3>

    {#if videos.length === 0}
      <div class="empty-grid">
        <p>No video clips uploaded yet.</p>
        <p>Click "Batch Upload Videos" to add video clips to your project.</p>
      </div>
    {:else}
      <div class="video-grid">
        {#each videos as video, index}
          <!-- Insertion point (only visible in reordering mode) -->
          {#if isReorderingMode && index === 0}
            <div
              class="insertion-point"
              on:click={() => handleInsertionClick(index)}
              on:keydown={(e) => e.key === 'Enter' && handleInsertionClick(index)}
              tabindex="0"
              role="button"
              aria-label="Insert video before position {index + 1}"
            >
              <span>+</span>
            </div>
          {/if}

          <!-- Video Thumbnail -->
          <div
            class="video-thumbnail {currentVideoIndex === index ? 'active' : ''}"
            draggable={isReorderingMode}
            on:dragstart={(e) => handleDragStart(e, index)}
            on:dragover={handleDragOver}
            on:drop={(e) => handleDrop(e, index)}
            on:click={() => !isReorderingMode && (currentVideoIndex = index)}
            on:keydown={(e) => e.key === 'Enter' && !isReorderingMode && (currentVideoIndex = index)}
            tabindex="0"
            role="button"
            aria-label="Video clip {index + 1}: {video.name}"
          >
            <!-- Video thumbnail with FFmpeg support -->
            {#if video.processing}
              <!-- Loading state while FFmpeg processes -->
              <div class="thumbnail-loading">
                <div class="loading-spinner"></div>
                <span class="loading-text">Processing...</span>
              </div>
            {:else if video.thumbnailUrl}
              <!-- FFmpeg-generated thumbnail -->
              <img
                src={video.thumbnailUrl}
                alt="Thumbnail for {video.name}"
                class="thumbnail-image"
              />
            {:else}
              <!-- Fallback placeholder -->
              <div class="thumbnail-placeholder">
                <span>📹</span>
                <span class="placeholder-text">{video.name.split('.')[0]}</span>
              </div>
            {/if}

            <!-- Video info overlay -->
            <div class="video-info">
              <span class="video-name">{video.name}</span>
              <span class="video-index">#{index + 1}</span>
            </div>

            <!-- Delete button (visible on hover) -->
            <button
              class="delete-btn"
              on:click|stopPropagation={() => deleteVideo(index)}
              aria-label="Delete video {video.name}"
            >
              ×
            </button>

            <!-- Current video indicator -->
            {#if currentVideoIndex === index}
              <div class="current-indicator">PLAYING</div>
            {/if}
          </div>

          <!-- Insertion point (only visible in reordering mode) -->
          {#if isReorderingMode}
            <div
              class="insertion-point"
              on:click={() => handleInsertionClick(index + 1)}
              on:keydown={(e) => e.key === 'Enter' && handleInsertionClick(index + 1)}
              tabindex="0"
              role="button"
              aria-label="Insert video after position {index + 1}"
            >
              <span>+</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <!-- Insertion Interface Modal -->
  {#if showInsertionInterface}
    <div
      class="modal-overlay"
      on:click={() => showInsertionInterface = false}
      on:keydown={(e) => e.key === 'Escape' && (showInsertionInterface = false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        class="insertion-modal"
        on:click|stopPropagation
        on:keydown|stopPropagation
      >
        <h4 id="modal-title">Insert Video at Position {insertionIndex + 1}</h4>
        <p>Select video files to insert at this position:</p>

        <input
          type="file"
          accept="video/*"
          multiple
          on:change={handleInsertionVideoSelect}
          class="file-input-modal"
        />

        <div class="modal-actions">
          <button class="btn secondary" on:click={() => showInsertionInterface = false}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .video-editor {
    background-color: #1e1e1e;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
    color: #e6e6e6;
  }
  
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .video-editor h2 {
    margin: 0;
    color: #00b8a9;
    font-size: 20px;
  }

  .ffmpeg-status {
    font-size: 12px;
  }

  .status-loading {
    color: #e9b83c;
  }

  .status-ready {
    color: #4ade80;
  }

  .status-error {
    color: #ef4444;
  }
  
  .controls-section {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  
  .sync-status {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 10px 15px;
    background-color: #2a2a2a;
    border-radius: 6px;
    border: 1px solid #444;
  }

  .status-label {
    font-size: 12px;
    color: #888;
    font-weight: 500;
  }

  .time-display {
    font-family: monospace;
    font-size: 14px;
    color: #a1a1aa;
    background-color: #333;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .play-status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .play-status.playing {
    background-color: rgba(0, 184, 169, 0.2);
    color: #00b8a9;
  }

  .play-status.paused {
    background-color: rgba(233, 184, 60, 0.2);
    color: #e9b83c;
  }

  .ffmpeg-status {
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
    background-color: rgba(100, 100, 100, 0.2);
    color: #ccc;
  }

  .loading-indicator {
    margin-left: 8px;
    font-size: 12px;
    opacity: 0.7;
  }
  
  .markers-control {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .markers-control label {
    font-size: 14px;
    color: #a1a1aa;
  }
  
  .slider {
    width: 120px;
    height: 4px;
    border-radius: 2px;
    background: #333;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }
  
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #00b8a9;
    cursor: pointer;
  }
  
  .slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #00b8a9;
    cursor: pointer;
    border: none;
  }
  
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  

  
  .btn.secondary {
    background-color: #333;
    color: #e6e6e6;
    border: 1px solid #555;
  }
  
  .btn.secondary:hover {
    background-color: #444;
  }
  
  .btn.active {
    background-color: #e9b83c;
    color: #121212;
  }
  
  .btn.active:hover {
    background-color: #f9d862;
  }

  /* Video Grid Styles */
  .video-grid-section {
    margin-top: 30px;
  }

  .video-grid-section h3 {
    margin-bottom: 15px;
    color: #e6e6e6;
    font-size: 16px;
  }

  .empty-grid {
    text-align: center;
    padding: 40px 20px;
    background-color: #2a2a2a;
    border-radius: 8px;
    border: 2px dashed #555;
  }

  .empty-grid p {
    margin: 5px 0;
    color: #a1a1aa;
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    padding: 10px 0;
  }

  .video-thumbnail {
    position: relative;
    aspect-ratio: 16/9;
    background-color: #2a2a2a;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .video-thumbnail:hover {
    border-color: #555;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .video-thumbnail.active {
    border-color: #00b8a9;
    box-shadow: 0 0 0 2px rgba(0, 184, 169, 0.3);
  }

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .thumbnail-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #333;
    color: #888;
  }

  .thumbnail-placeholder span:first-child {
    font-size: 24px;
    margin-bottom: 5px;
  }

  .placeholder-text {
    font-size: 12px;
    text-align: center;
    padding: 0 8px;
    word-break: break-word;
  }

  .thumbnail-loading {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #2a2a2a;
    color: #888;
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #444;
    border-top: 2px solid #00b8a9;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 8px;
  }

  .loading-text {
    font-size: 11px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .video-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    padding: 10px 8px 8px;
    color: white;
  }

  .video-name {
    display: block;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-index {
    font-size: 10px;
    opacity: 0.8;
  }

  .delete-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: rgba(255, 0, 0, 0.8);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .video-thumbnail:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background-color: rgba(255, 0, 0, 1);
  }

  .current-indicator {
    position: absolute;
    top: 8px;
    left: 8px;
    background-color: #00b8a9;
    color: #121212;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: bold;
  }

  .insertion-point {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16/9;
    background-color: #333;
    border: 2px dashed #666;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #888;
    font-size: 24px;
    font-weight: bold;
  }

  .insertion-point:hover {
    border-color: #00b8a9;
    background-color: rgba(0, 184, 169, 0.1);
    color: #00b8a9;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .insertion-modal {
    background-color: #2a2a2a;
    border-radius: 8px;
    padding: 20px;
    max-width: 400px;
    width: 90%;
    color: #e6e6e6;
  }

  .insertion-modal h4 {
    margin-top: 0;
    color: #00b8a9;
  }

  .file-input-modal {
    width: 100%;
    padding: 10px;
    margin: 15px 0;
    background-color: #333;
    border: 1px solid #555;
    border-radius: 4px;
    color: #e6e6e6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 15px;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .video-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }

    .controls-section {
      flex-direction: column;
      align-items: stretch;
      gap: 15px;
    }
  }
</style>
