<script>
  import { onMount, onDestroy } from 'svelte';
  import VideoPlayer from './VideoPlayer.svelte';
  import Markers from './Markers.svelte';
  import ffmpegService from './ffmpegService.js';

  // Props using Svelte 5 syntax
  let {
    audioUrl = '',
    isPlaying = false,
    currentTime = 0,
    duration = 0,
    audioMarkers = [], // Real markers from AudioTimeline
    speedRampState = { enabled: false, currentSpeed: 1.0 } // Speed ramping state from AudioTimeline
  } = $props();
  
  // Video management state using Svelte 5 runes
  let videos = $state([]);
  let currentVideoIndex = $state(0);
  let currentVideo = $state(null);
  let savedPositions = $state({});
  let videoPlayerComponent = $state();
  
  // Speed ramping state
  let currentVideoSpeed = $state(1.0);
  let speedRampTimeout = $state(null);
  
  // Video preloading for seamless switching
  let preloadedVideos = $state(new Map()); // Map of video IDs to preloaded video elements
  let preloadQueue = $state([]);
  const MAX_PRELOADED = 3; // Maximum number of videos to keep preloaded
  
  // Audio synchronization state
  let markers = $state([]);
  let markersPerShot = $state(4); // Default value from task list
  let lastMarkerIndex = $state(-1);
  let markerCount = $state(0);
  let lastSwitchTime = $state(0); // Throttle switching
  let minSwitchInterval = $state(200); // Minimum 200ms between switches - reduced for smoother switching
  let seenVideos = $state(new Set()); // Track which videos we've seen in this cycle
  
  // UI state
  let isReorderingMode = $state(false);
  let draggedIndex = $state(null);
  let insertionIndex = $state(null);
  let showInsertionInterface = $state(false);
  let ffmpegLoaded = $state(false);
  let ffmpegLoading = $state(false);

  // File input reference
  let videoFileInput = $state();
  
  // Derived state for current video
  let currentVideoComputed = $derived(videos.length > 0 ? videos[currentVideoIndex] : null);
  
  // Effect to handle speed ramping changes
  $effect(() => {
    console.log('🎬 VideoEditor: Speed ramp state changed:', speedRampState);
    if (speedRampState && speedRampState.currentSpeed !== currentVideoSpeed) {
      console.log('🚀 VideoEditor: Applying speed ramp:', speedRampState.currentSpeed);
      currentVideoSpeed = speedRampState.currentSpeed;
      
      // Apply speed to video player
      if (videoPlayerComponent && videoPlayerComponent.setPlaybackRate) {
        console.log('📺 Calling setPlaybackRate on video player');
        videoPlayerComponent.setPlaybackRate(currentVideoSpeed);
      } else {
        console.warn('⚠️ VideoPlayer component not ready or missing setPlaybackRate method');
      }
    }
  });
  
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
    
    // Clean up preloaded videos
    for (const [videoId, videoEl] of preloadedVideos.entries()) {
      if (videoEl.parentNode) {
        videoEl.parentNode.removeChild(videoEl);
      }
    }
    preloadedVideos.clear();
  });
  
  // No need to load audio - we sync with parent AudioTimeline
  
  // Watch for audio time changes and handle marker-driven switching (throttled)
  let lastMarkerCheckTime = 0; // NOT reactive - regular variable
  let lastCheckedTime = -1; // NOT reactive - regular variable
  $effect(() => {
    if (isPlaying && markers.length > 0 && videos.length > 1) {
      const now = Date.now();
      // Throttle marker checking and avoid checking the same time twice
      if (now - lastMarkerCheckTime > 32 && Math.abs(currentTime - lastCheckedTime) > 0.01) { // Better precision
        lastMarkerCheckTime = now;
        lastCheckedTime = currentTime;
        checkMarkerSwitching(currentTime);
      }
    }
  });
  
  // Also watch for currentVideoIndex changes to update the active video
  $effect(() => {
    if (videos.length > 0 && currentVideoIndex >= 0 && currentVideoIndex < videos.length) {
      const newVideo = videos[currentVideoIndex];
      console.log(`🎬 Current video index changed to: ${currentVideoIndex} (${newVideo?.name})`);
      
      // Force update the currentVideo reactive variable
      currentVideo = newVideo;
    }
  });
  
  // Audio sync is handled by parent AudioTimeline component
  
  // Load markers from AudioTimeline component
  function loadMarkers() {
    // Use real markers from AudioTimeline if available, otherwise use fallback
    if (audioMarkers && audioMarkers.length > 0) {
      // Extract time positions from marker objects
      markers = audioMarkers.map(marker => {
        // Handle different marker formats
        if (typeof marker === 'number') {
          return marker;
        } else if (marker.start !== undefined) {
          return marker.start;
        } else if (marker.time !== undefined) {
          return marker.time;
        }
        return 0;
      }).filter(time => time > 0).sort((a, b) => a - b);
      
      console.log(`🎯 Loaded ${markers.length} real audio markers:`, markers.slice(0, 10));
    } else {
      // Fallback to sample markers for testing when no real markers available
      markers = [
        0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
        5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
        10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0
      ];
      console.log(`🎯 Using fallback sample markers for testing (${markers.length} markers)`);
    }
    
    // Reset marker counting when markers change
    lastMarkerIndex = -1;
    markerCount = 0;
    console.log(`🔄 Reset marker counting - markersPerShot: ${markersPerShot}`);
  }
  
  // Watch for changes in audioMarkers and reload (with dependency check to prevent loops)
  let lastAudioMarkersLength = 0; // NOT reactive - regular variable
  $effect(() => {
    if (audioMarkers !== undefined && audioMarkers.length !== lastAudioMarkersLength) {
      lastAudioMarkersLength = audioMarkers.length;
      loadMarkers();
    }
  });
  
  function checkMarkerSwitching(time) {
    // State validation
    if (!isPlaying || markers.length === 0 || videos.length <= 1) {
      return;
    }
    
    if (typeof time !== 'number' || time < 0) {
      console.warn('⚠️ Invalid time for marker switching:', time);
      return;
    }

    try {
      // Find the current marker index with better precision
      const currentMarkerIndex = markers.findIndex(marker => marker > time + 0.05) - 1; // Add 50ms tolerance

      if (currentMarkerIndex !== lastMarkerIndex && currentMarkerIndex >= 0) {
        markerCount++;
        lastMarkerIndex = currentMarkerIndex;

        console.log(`🎯 Marker hit #${markerCount} at ${time.toFixed(2)}s (marker index: ${currentMarkerIndex}) - markersPerShot: ${markersPerShot}`);

        // Switch video every markersPerShot markers (with throttling)
        if (markerCount >= markersPerShot) {
          const now = Date.now();
          if (now - lastSwitchTime >= minSwitchInterval) {
            console.log(`🔄 TRIGGERING VIDEO SWITCH after ${markersPerShot} markers`);
            const previousIndex = currentVideoIndex;
            const switchSuccess = switchToNextVideo();
            if (switchSuccess) {
              markerCount = 0;
              lastSwitchTime = now;
              console.log(`✅ Video switched from ${previousIndex} to ${currentVideoIndex}`);
            } else {
              console.warn('⚠️ Video switch failed, keeping marker count');
            }
          } else {
            console.log(`⏳ Throttling switch - waiting ${minSwitchInterval - (now - lastSwitchTime)}ms`);
          }
        } else {
          console.log(`⏳ Waiting for ${markersPerShot - markerCount} more markers before switching`);
        }
      }
    } catch (error) {
      console.error('❌ Error during marker switching:', error);
    }
  }
  
  function switchToNextVideo() {
    // State validation
    if (videos.length === 0) {
      console.warn('⚠️ Cannot switch video - no videos loaded');
      return false;
    }
    
    if (videos.length === 1) {
      console.log('ℹ️ Only one video available, no switching needed');
      return false;
    }

    try {
      const previousIndex = currentVideoIndex;
      const previousVideo = currentVideo;

      // Validate current video state
      if (!currentVideo) {
        console.warn('⚠️ No current video to switch from');
        currentVideoIndex = 0;
        return true;
      }

      // Save current video position from the actual video element
      if (videoPlayerComponent) {
        try {
          const videoCurrentTime = videoPlayerComponent.getCurrentTime();
          if (videoCurrentTime !== null && videoCurrentTime >= 0) {
            savedPositions[currentVideo.id] = videoCurrentTime;
            console.log(`💾 Saved video position ${videoCurrentTime.toFixed(2)}s for video: ${currentVideo.name}`);
          }
        } catch (error) {
          console.warn('⚠️ Could not save video position:', error.message);
        }
      }

      // Move to next video in sequence
      const nextIndex = (currentVideoIndex + 1) % videos.length;
      const nextVideo = videos[nextIndex];
      
      // Validate next video
      if (!nextVideo || !nextVideo.url || !nextVideo.file) {
        console.error('❌ Next video is invalid:', nextVideo);
        // Try to find a valid video
        for (let i = 0; i < videos.length; i++) {
          const testVideo = videos[i];
          if (testVideo && testVideo.url && testVideo.file) {
            currentVideoIndex = i;
            console.log(`🔄 Found valid video at index ${i}: ${testVideo.name}`);
            return true;
          }
        }
        console.error('❌ No valid videos found');
        return false;
      }

      // INSTANT SWITCH: Just change the index, VideoPlayer will handle the transition
      currentVideoIndex = nextIndex;
      
      // Check if this is a video we've seen before (looping back)
      const isLoopingBack = seenVideos.has(nextVideo.id);
      if (isLoopingBack) {
        console.log(`🔄 LOOPING BACK to video ${currentVideoIndex + 1} (${nextVideo?.name}) - clearing saved position for smooth transition`);
        // Clear saved position to avoid jumps when looping back
        delete savedPositions[nextVideo.id];
      } else {
        console.log(`🎬 FIRST TIME seeing video ${currentVideoIndex + 1} (${nextVideo?.name})`);
        seenVideos.add(nextVideo.id);
      }

      // Log if we have a saved position for the new video
      if (savedPositions[nextVideo.id] !== undefined) {
        console.log(`⏰ Will resume video from saved position: ${savedPositions[nextVideo.id].toFixed(2)}s`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error during video switching:', error);
      return false;
    }
  }
  
  // Get video URL for playback
  function getVideoUrl(video) {
    if (!video) return null;
    return video.url;
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
          processing: false // Don't show processing animation initially
        };

        // Add video to list immediately - ready for playback
        videos = [...videos, video];
        console.log(`✅ Video ready for playback: ${video.name}`);

        // Generate thumbnail using HTML5 video + canvas (more reliable)
        setTimeout(() => generateSimpleThumbnail(video), 100);
      } else {
        console.warn(`⚠️ Skipping non-video file: ${file.name} (${file.type})`);
      }
    }

    // Reset file input
    event.target.value = '';
    console.log('📁 Video file processing complete - all videos ready for playback');
  }

  // Thumbnail generation queue and processing flag
let thumbnailQueue = [];
let thumbnailProcessing = false;

function enqueueThumbnailJob(video) {
  thumbnailQueue.push(video);
  processThumbnailQueue();
}

async function processThumbnailQueue() {
  if (thumbnailProcessing || thumbnailQueue.length === 0) return;
  
  console.log(`🔄 Processing thumbnail queue: ${thumbnailQueue.length} items remaining`);
  thumbnailProcessing = true;
  const video = thumbnailQueue.shift();
  
  try {
    await generateThumbnailSerial(video);
  } catch (error) {
    console.error(`❌ Thumbnail queue processing failed for ${video?.name}:`, error);
  } finally {
    thumbnailProcessing = false;
    // Process next job
    if (thumbnailQueue.length > 0) {
      console.log(`⏭️ Processing next thumbnail in queue`);
      setTimeout(() => processThumbnailQueue(), 100); // Small delay between processing
    } else {
      console.log(`✅ Thumbnail queue processing complete`);
    }
  }
}

// Generate thumbnails serially (called by queue processor)
async function generateThumbnailSerial(video) {
  try {
    console.log(`🖼️ [QUEUE] Starting thumbnail generation for: ${video.name} (ID: ${video.id})`);
    
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
      // Mark as not processing but keep video name visible
      videos = videos.map(v => v.id === video.id ? { ...v, processing: false } : v);
      return;
    }
    
    console.log(`🖼️ FFmpeg ready, generating thumbnail for: ${video.name}`);
    
    // Generate thumbnail at 1 second mark
    const thumbnailUrl = await ffmpegService.generateThumbnail(video.file, 1.0);
    console.log(`✅ Thumbnail generated successfully for ${video.name}:`, thumbnailUrl);
    
    // Update video with thumbnail - force reactivity
    videos = videos.map(v =>
      v.id === video.id
        ? { ...v, thumbnailUrl, processing: false, loaded: true }
        : v
    );
    
    console.log(`🔄 Updated video ${video.id} with thumbnail`);
    
  } catch (error) {
    console.error(`❌ Thumbnail generation failed for ${video.name}:`, error);
    console.error('Error details:', error.message);
    
    // Mark as not processing but keep video name visible
    videos = videos.map(v => v.id === video.id ? { ...v, processing: false, loaded: true } : v);
  }
}

// Simple thumbnail generation using HTML5 video and canvas
function generateSimpleThumbnail(video) {
  try {
    console.log(`🖼️ Generating simple thumbnail for: ${video.name}`);
    
    // Mark as processing
    videos = videos.map(v => v.id === video.id ? { ...v, processing: true } : v);
    
    // Create a hidden video element
    const videoEl = document.createElement('video');
    videoEl.crossOrigin = 'anonymous';
    videoEl.muted = true;
    videoEl.style.display = 'none';
    document.body.appendChild(videoEl);
    
    videoEl.onloadeddata = () => {
      try {
        // Seek to 1 second
        videoEl.currentTime = 1.0;
      } catch (error) {
        console.warn('Could not seek to 1 second, using current frame');
        generateThumbnailFromCurrentFrame();
      }
    };
    
    videoEl.onseeked = generateThumbnailFromCurrentFrame;
    videoEl.onerror = () => {
      console.error(`❌ Video load error for ${video.name}`);
      cleanup();
      // Mark as not processing, show video name
      videos = videos.map(v => v.id === video.id ? { ...v, processing: false } : v);
    };
    
    function generateThumbnailFromCurrentFrame() {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = 320;
        canvas.height = (videoEl.videoHeight / videoEl.videoWidth) * 320;
        
        // Draw video frame to canvas
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob URL
        canvas.toBlob((blob) => {
          const thumbnailUrl = URL.createObjectURL(blob);
          console.log(`✅ Simple thumbnail generated for ${video.name}`);
          
          // Update video with thumbnail
          videos = videos.map(v =>
            v.id === video.id
              ? { ...v, thumbnailUrl, processing: false, loaded: true }
              : v
          );
          
          cleanup();
        }, 'image/jpeg', 0.8);
        
      } catch (error) {
        console.error(`❌ Canvas thumbnail generation failed for ${video.name}:`, error);
        cleanup();
        videos = videos.map(v => v.id === video.id ? { ...v, processing: false } : v);
      }
    }
    
    function cleanup() {
      if (videoEl.parentNode) {
        videoEl.parentNode.removeChild(videoEl);
      }
    }
    
    // Load the video
    videoEl.src = video.url;
    videoEl.load();
    
  } catch (error) {
    console.error(`❌ Simple thumbnail generation failed for ${video.name}:`, error);
    videos = videos.map(v => v.id === video.id ? { ...v, processing: false } : v);
  }
}

// Backwards-compatible background generator (now enqueues)
function generateThumbnailInBackground(video) {
  // Mark as processing
  videos = videos.map(v => v.id === video.id ? { ...v, processing: true } : v);
  console.log(`🖼️ Starting thumbnail generation for: ${video.name}`);
  
  // Try direct generation first, fallback to queue if needed
  generateThumbnailDirect(video);
}

// Direct thumbnail generation (simpler approach)
async function generateThumbnailDirect(video) {
  try {
    console.log(`🖼️ [DIRECT] Starting thumbnail generation for: ${video.name}`);
    
    // Initialize FFmpeg if needed
    if (!ffmpegLoaded && !ffmpegLoading) {
      console.log('🔄 Initializing FFmpeg for thumbnail generation...');
      await initializeFFmpeg();
    }
    
    // Wait for FFmpeg if it's loading
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!ffmpegLoaded) {
      console.warn('⚠️ FFmpeg not available, showing video name only');
      videos = videos.map(v => v.id === video.id ? { ...v, processing: false } : v);
      return;
    }
    
    console.log(`🖼️ Generating thumbnail for: ${video.name}`);
    const thumbnailUrl = await ffmpegService.generateThumbnail(video.file, 1.0);
    console.log(`✅ Thumbnail generated: ${thumbnailUrl}`);
    
    // Update video with thumbnail
    videos = videos.map(v =>
      v.id === video.id
        ? { ...v, thumbnailUrl, processing: false, loaded: true }
        : v
    );
    
    console.log(`🔄 Updated video ${video.name} with thumbnail`);
    
  } catch (error) {
    console.error(`❌ Direct thumbnail generation failed for ${video.name}:`, error);
    
    // Mark as not processing, show video name
    videos = videos.map(v => v.id === video.id ? { ...v, processing: false } : v);
  }
}

// Video preloading system for seamless switching
function preloadNextVideos() {
  if (videos.length <= 1) return;
  
  // Clear old preloaded videos that are no longer needed
  cleanupPreloadedVideos();
  
  // Determine which videos to preload (next 2-3 videos in sequence)
  const videosToPreload = [];
  for (let i = 1; i <= MAX_PRELOADED && i < videos.length; i++) {
    const nextIndex = (currentVideoIndex + i) % videos.length;
    const nextVideo = videos[nextIndex];
    if (nextVideo && !preloadedVideos.has(nextVideo.id)) {
      videosToPreload.push(nextVideo);
    }
  }
  
  // Preload each video
  videosToPreload.forEach(video => {
    preloadVideo(video);
  });
}

function preloadVideo(video) {
  if (!video || !video.url || preloadedVideos.has(video.id)) return;
  
  console.log(`🔄 Preloading video: ${video.name}`);
  
  const videoEl = document.createElement('video');
  videoEl.src = video.url;
  videoEl.muted = true;
  videoEl.preload = 'auto';
  videoEl.style.display = 'none';
  videoEl.style.position = 'absolute';
  videoEl.style.top = '-9999px';
  
  // Enhanced preloading - ensure video is fully ready
  const preloadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn(`⚠️ Preload timeout for ${video.name}`);
      cleanup();
      resolve(); // Don't reject, just resolve to prevent blocking
    }, 3000); // Further reduced timeout to 3s
    
    const handleLoadedData = () => {
      clearTimeout(timeout);
      console.log(`✅ Video preloaded: ${video.name} (readyState: ${videoEl.readyState})`);
      
      // Restore saved position if available
      if (savedPositions[video.id] !== undefined) {
        videoEl.currentTime = savedPositions[video.id];
        console.log(`⏰ Preload restored position: ${savedPositions[video.id].toFixed(2)}s`);
      }
      
      preloadedVideos.set(video.id, videoEl);
      cleanup();
      resolve();
    };
    
    const handleError = (error) => {
      clearTimeout(timeout);
      console.error(`❌ Failed to preload video ${video.name}:`, error);
      cleanup();
      reject(error);
    };
    
    const cleanup = () => {
      videoEl.removeEventListener('loadeddata', handleLoadedData);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('canplaythrough', handleLoadedData);
    };
    
    videoEl.addEventListener('loadeddata', handleLoadedData);
    videoEl.addEventListener('canplaythrough', handleLoadedData);
    videoEl.addEventListener('error', handleError);
  });
  
  // Add to DOM temporarily to trigger loading
  document.body.appendChild(videoEl);
  videoEl.load();
  
  // Clean up DOM element after preloading (keep video element in memory)
  preloadPromise.finally(() => {
    if (videoEl.parentNode) {
      videoEl.parentNode.removeChild(videoEl);
    }
  });
}

function cleanupPreloadedVideos() {
  // Remove preloaded videos that are too far from current position
  const videosToKeep = new Set();
  
  // Keep current video and next few videos
  for (let i = 0; i <= MAX_PRELOADED && i < videos.length; i++) {
    const keepIndex = (currentVideoIndex + i) % videos.length;
    const keepVideo = videos[keepIndex];
    if (keepVideo) {
      videosToKeep.add(keepVideo.id);
    }
  }
  
  // Remove videos not in keep set
  for (const [videoId, videoEl] of preloadedVideos.entries()) {
    if (!videosToKeep.has(videoId)) {
      console.log(`🧹 Cleaning up preloaded video: ${videoId}`);
      // Clean up video element resources
      if (videoEl) {
        videoEl.src = '';
        videoEl.load(); // This helps free up memory
        if (videoEl.parentNode) {
          videoEl.parentNode.removeChild(videoEl);
        }
      }
      preloadedVideos.delete(videoId);
    }
  }
}

function getPreloadedVideo(videoId) {
  const preloadedVideo = preloadedVideos.get(videoId);
  if (preloadedVideo) {
    console.log(`🎯 Found preloaded video for ${videoId}, readyState: ${preloadedVideo.readyState}`);
  }
  return preloadedVideo;
}

// Watch for video index changes to trigger preloading
// TEMPORARILY DISABLED - preloading is causing timeouts and blocking playback
// $: if (currentVideoIndex >= 0 && videos.length > 1) {
//   preloadNextVideos();
// }

  
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
    try {
      const { id, position } = event.detail;
      
      // Validate input
      if (!id || typeof position !== 'number' || position < 0) {
        console.warn('⚠️ Invalid position save data:', { id, position });
        return;
      }
      
      savedPositions[id] = position;
      console.log(`💾 Video position saved: ${position.toFixed(2)}s for video ID: ${id}`);
    } catch (error) {
      console.error('❌ Error saving video position:', error);
    }
  }
  
  // Handle video errors from VideoPlayer
  function handleVideoError(event) {
    const { error, video } = event.detail;
    console.error(`❌ Video error for ${video?.name || 'unknown video'}:`, error);
    
    // Could implement recovery strategies here:
    // - Try to reload the video
    // - Skip to next video
    // - Show user notification
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
    </button>
    
    <!-- Reordering Mode Toggle -->
    <button
      class="btn {isReorderingMode ? 'active' : 'secondary'}"
      on:click={toggleReorderingMode}
    >
      {isReorderingMode ? 'Exit Reorder Mode' : 'Reorder Mode'}
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
  <div style="width: 100%; max-width: 900px; margin: 0 auto;">
  <div class="main-player-frame">
    <VideoPlayer
      bind:this={videoPlayerComponent}
      currentVideo={currentVideo}
      playing={isPlaying}
      {savedPositions}
      {getPreloadedVideo}
      playbackRate={currentVideoSpeed}
      on:saveposition={handleVideoPositionSave}
      on:videoerror={handleVideoError}
    />
  </div>
</div>
  
  <!-- Markers Display -->
  <Markers
    markers={markers}
    {currentTime}
    {duration}
    playing={isPlaying}
  />

  <!-- Video Grid -->
  <div class="video-grid-section">
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
          <button
            class="video-thumbnail {currentVideoIndex === index ? 'active' : ''}"
            draggable={isReorderingMode}
            on:dragstart={(e) => handleDragStart(e, index)}
            on:dragover={handleDragOver}
            on:drop={(e) => handleDrop(e, index)}
            on:click={() => !isReorderingMode && (currentVideoIndex = index)}
            disabled={isReorderingMode}
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
              <!-- Show actual thumbnail -->
              <img
                src={video.thumbnailUrl}
                alt="Thumbnail for {video.name}"
                class="thumbnail-image"
                on:load={() => console.log(`✅ Thumbnail loaded for ${video.name}`)}
                on:error={() => console.error(`❌ Thumbnail failed to load for ${video.name}`)}
              />
            {:else}
              <!-- Placeholder when no thumbnail available -->
              <div class="thumbnail-placeholder">
                <span>📹</span>
                <div class="video-name">{video.name.length > 15 ? video.name.substring(0, 15) + '...' : video.name}</div>
              </div>
            {/if}

            <!-- Current video indicator -->
            {#if currentVideoIndex === index}
              <div class="current-indicator">PLAYING</div>
            {/if}
          </button>

          <!-- Insertion point (only visible in reordering mode) -->
          {#if isReorderingMode}
            <button
              class="insertion-point"
              on:click={() => handleInsertionClick(index + 1)}
              aria-label="Insert video after position {index + 1}"
            >
              <span>+</span>
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <!-- Insertion Interface Modal -->
  {#if showInsertionInterface}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="modal-overlay"
      role="presentation"
      on:click={() => showInsertionInterface = false}
    >
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <div
        class="insertion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabindex="0"
        on:keydown={(e) => { if (e.key === 'Escape') showInsertionInterface = false; }}
        on:click|stopPropagation
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

  .video-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
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

  .video-thumbnail {
    position: relative;
    aspect-ratio: 16/9;
    background-color: #2a2a2a;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    padding: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
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
  
  .video-name {
    font-size: 10px;
    text-align: center;
    margin-top: 5px;
    opacity: 0.7;
  }

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
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
    padding: 0;
    width: 100%;
    height: 100%;
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
.main-player-frame {
  width: 100%;
  aspect-ratio: 16/9;
  background: #111;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

/* Ensure the video element inside VideoPlayer fills and covers the frame */

</style>
