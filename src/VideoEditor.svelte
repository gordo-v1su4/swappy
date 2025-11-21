<script>
  import { onMount, onDestroy } from "svelte";
  import VideoPlayer from "./VideoPlayer.svelte";
  import Markers from "./Markers.svelte";
  import ffmpegService from "./ffmpegService.js";

  // Props using Svelte 5 syntax
  let {
    audioUrl = "",
    isPlaying = false,
    currentTime = 0,
    duration = 0,
    audioMarkers = [], // Real markers from AudioTimeline
    speedRampState = { enabled: false, currentSpeed: 1.0 }, // Speed ramping state from AudioTimeline
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
  let currentVideoComputed = $derived(
    videos.length > 0 ? videos[currentVideoIndex] : null,
  );

  // Effect to handle speed ramping changes
  $effect(() => {
    console.log(
      "🎬 VideoEditor: Speed ramp state changed:",
      $state.snapshot(speedRampState),
    );
    if (speedRampState && speedRampState.currentSpeed !== currentVideoSpeed) {
      console.log(
        "🚀 VideoEditor: Applying speed ramp:",
        speedRampState.currentSpeed,
      );
      currentVideoSpeed = speedRampState.currentSpeed;

      // Apply speed to video player
      if (videoPlayerComponent && videoPlayerComponent.setPlaybackRate) {
        console.log("📺 Calling setPlaybackRate on video player");
        videoPlayerComponent.setPlaybackRate(currentVideoSpeed);
      } else {
        console.warn(
          "⚠️ VideoPlayer component not ready or missing setPlaybackRate method",
        );
      }
    }
  });

  // Load beat markers from external source (placeholder for now)
  onMount(() => {
    loadMarkers();
    console.log("🎬 VideoEditor component mounted");

    // Don't initialize FFmpeg immediately - wait for user action
    // This avoids blocking the UI on startup
  });

  async function initializeFFmpeg() {
    try {
      ffmpegLoading = true;
      console.log("🔄 Initializing FFmpeg WASM...");
      await ffmpegService.load();
      ffmpegLoaded = true;
      console.log("✅ FFmpeg initialized successfully");

      // Set up logging for FFmpeg operations
      ffmpegService.setLogCallback(({ type, message }) => {
        if (type === "error") {
          console.error("FFmpeg Error:", message);
        } else {
          console.log("FFmpeg:", message);
        }
      });
    } catch (error) {
      console.error("❌ Failed to initialize FFmpeg:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    } finally {
      ffmpegLoading = false;
    }
  }

  onDestroy(() => {
    // Clean up object URLs
    videos.forEach((video) => {
      if (video.url.startsWith("blob:")) {
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
      if (
        now - lastMarkerCheckTime > 32 &&
        Math.abs(currentTime - lastCheckedTime) > 0.01
      ) {
        // Better precision
        lastMarkerCheckTime = now;
        lastCheckedTime = currentTime;
        checkMarkerSwitching(currentTime);
      }
    }
  });

  // Also watch for currentVideoIndex changes to update the active video
  $effect(() => {
    if (
      videos.length > 0 &&
      currentVideoIndex >= 0 &&
      currentVideoIndex < videos.length
    ) {
      const newVideo = videos[currentVideoIndex];
      console.log(
        `🎬 Current video index changed to: ${currentVideoIndex} (${newVideo?.name})`,
      );

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
      markers = audioMarkers
        .map((marker) => {
          // Handle different marker formats
          if (typeof marker === "number") {
            return marker;
          } else if (marker.start !== undefined) {
            return marker.start;
          } else if (marker.time !== undefined) {
            return marker.time;
          }
          return 0;
        })
        .filter((time) => time > 0)
        .sort((a, b) => a - b);

      console.log(
        `🎯 Loaded ${markers.length} real audio markers:`,
        markers.slice(0, 10),
      );
    } else {
      // Fallback to sample markers for testing when no real markers available
      markers = [
        0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0,
        7.5, 8.0, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5,
        14.0, 14.5, 15.0,
      ];
      console.log(
        `🎯 Using fallback sample markers for testing (${markers.length} markers)`,
      );
    }

    // Reset marker counting when markers change
    lastMarkerIndex = -1;
    markerCount = 0;
    console.log(`🔄 Reset marker counting - markersPerShot: ${markersPerShot}`);
  }

  // Watch for changes in audioMarkers and reload (with dependency check to prevent loops)
  let lastAudioMarkersLength = 0; // NOT reactive - regular variable
  $effect(() => {
    if (
      audioMarkers !== undefined &&
      audioMarkers.length !== lastAudioMarkersLength
    ) {
      lastAudioMarkersLength = audioMarkers.length;
      loadMarkers();
    }
  });

  function checkMarkerSwitching(time) {
    // State validation
    if (!isPlaying || markers.length === 0 || videos.length <= 1) {
      return;
    }

    if (typeof time !== "number" || time < 0) {
      console.warn("⚠️ Invalid time for marker switching:", time);
      return;
    }

    try {
      // Find the current marker index with better precision
      const currentMarkerIndex =
        markers.findIndex((marker) => marker > time + 0.05) - 1; // Add 50ms tolerance

      if (currentMarkerIndex !== lastMarkerIndex && currentMarkerIndex >= 0) {
        markerCount++;
        lastMarkerIndex = currentMarkerIndex;

        console.log(
          `🎯 Marker hit #${markerCount} at ${time.toFixed(2)}s (marker index: ${currentMarkerIndex}) - markersPerShot: ${markersPerShot}`,
        );

        // Switch video every markersPerShot markers (with throttling)
        if (markerCount >= markersPerShot) {
          const now = Date.now();
          if (now - lastSwitchTime >= minSwitchInterval) {
            console.log(
              `🔄 TRIGGERING VIDEO SWITCH after ${markersPerShot} markers`,
            );
            const previousIndex = currentVideoIndex;
            const switchSuccess = switchToNextVideo();
            if (switchSuccess) {
              markerCount = 0;
              lastSwitchTime = now;
              console.log(
                `✅ Video switched from ${previousIndex} to ${currentVideoIndex}`,
              );
            } else {
              console.warn("⚠️ Video switch failed, keeping marker count");
            }
          } else {
            console.log(
              `⏳ Throttling switch - waiting ${minSwitchInterval - (now - lastSwitchTime)}ms`,
            );
          }
        } else {
          console.log(
            `⏳ Waiting for ${markersPerShot - markerCount} more markers before switching`,
          );
        }
      }
    } catch (error) {
      console.error("❌ Error during marker switching:", error);
    }
  }

  function switchToNextVideo() {
    // State validation
    if (videos.length === 0) {
      console.warn("⚠️ Cannot switch video - no videos loaded");
      return false;
    }

    if (videos.length === 1) {
      console.log("ℹ️ Only one video available, no switching needed");
      return false;
    }

    try {
      const previousIndex = currentVideoIndex;
      const previousVideo = currentVideo;

      // Validate current video state
      if (!currentVideo) {
        console.warn("⚠️ No current video to switch from");
        currentVideoIndex = 0;
        return true;
      }

      // Save current video position from the actual video element
      if (videoPlayerComponent) {
        try {
          const videoCurrentTime = videoPlayerComponent.getCurrentTime();
          if (videoCurrentTime !== null && videoCurrentTime >= 0) {
            savedPositions[currentVideo.id] = videoCurrentTime;
            console.log(
              `💾 Saved video position ${videoCurrentTime.toFixed(2)}s for video: ${currentVideo.name}`,
            );
          }
        } catch (error) {
          console.warn("⚠️ Could not save video position:", error.message);
        }
      }

      // Move to next video in sequence
      const nextIndex = (currentVideoIndex + 1) % videos.length;
      const nextVideo = videos[nextIndex];

      // Validate next video
      if (!nextVideo || !nextVideo.url || !nextVideo.file) {
        console.error("❌ Next video is invalid:", nextVideo);
        // Try to find a valid video
        for (let i = 0; i < videos.length; i++) {
          const testVideo = videos[i];
          if (testVideo && testVideo.url && testVideo.file) {
            currentVideoIndex = i;
            console.log(
              `🔄 Found valid video at index ${i}: ${testVideo.name}`,
            );
            return true;
          }
        }
        console.error("❌ No valid videos found");
        return false;
      }

      // INSTANT SWITCH: Just change the index, VideoPlayer will handle the transition
      currentVideoIndex = nextIndex;

      // Check if this is a video we've seen before (looping back)
      const isLoopingBack = seenVideos.has(nextVideo.id);
      if (isLoopingBack) {
        console.log(
          `🔄 LOOPING BACK to video ${currentVideoIndex + 1} (${nextVideo?.name}) - clearing saved position for smooth transition`,
        );
        // Clear saved position to avoid jumps when looping back
        delete savedPositions[nextVideo.id];
      } else {
        console.log(
          `🎬 FIRST TIME seeing video ${currentVideoIndex + 1} (${nextVideo?.name})`,
        );
        seenVideos.add(nextVideo.id);
      }

      // Log if we have a saved position for the new video
      if (savedPositions[nextVideo.id] !== undefined) {
        console.log(
          `⏰ Will resume video from saved position: ${savedPositions[nextVideo.id].toFixed(2)}s`,
        );
      }

      return true;
    } catch (error) {
      console.error("❌ Error during video switching:", error);
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
    console.log("📁 Processing video file upload...");
    const files = Array.from(event.target.files);
    console.log(`📊 ${files.length} files selected`);

    for (const file of files) {
      if (file.type.startsWith("video/")) {
        console.log(
          `🎬 Processing video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        );

        const video = {
          id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url: URL.createObjectURL(file), // Create URL immediately for instant playback
          file: file,
          thumbnailUrl: null,
          loaded: true, // Mark as loaded immediately
          processing: false, // Don't show processing animation initially
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
    event.target.value = "";
    console.log(
      "📁 Video file processing complete - all videos ready for playback",
    );
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

    console.log(
      `🔄 Processing thumbnail queue: ${thumbnailQueue.length} items remaining`,
    );
    thumbnailProcessing = true;
    const video = thumbnailQueue.shift();

    try {
      await generateThumbnailSerial(video);
    } catch (error) {
      console.error(
        `❌ Thumbnail queue processing failed for ${video?.name}:`,
        error,
      );
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
      console.log(
        `🖼️ [QUEUE] Starting thumbnail generation for: ${video.name} (ID: ${video.id})`,
      );

      // Initialize FFmpeg only when we need thumbnails
      if (!ffmpegLoaded && !ffmpegLoading) {
        console.log("🔄 Initializing FFmpeg for thumbnail generation...");
        await initializeFFmpeg();
      }

      // Wait for FFmpeg if it's loading
      if (ffmpegLoading) {
        console.log(
          "⏳ Waiting for FFmpeg to load for thumbnail generation...",
        );
        while (ffmpegLoading) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!ffmpegLoaded) {
        console.warn("⚠️ FFmpeg not available, skipping thumbnail generation");
        // Mark as not processing but keep video name visible
        videos = videos.map((v) =>
          v.id === video.id ? { ...v, processing: false } : v,
        );
        return;
      }

      console.log(`🖼️ FFmpeg ready, generating thumbnail for: ${video.name}`);

      // Generate thumbnail at 1 second mark
      const thumbnailUrl = await ffmpegService.generateThumbnail(
        video.file,
        1.0,
      );
      console.log(
        `✅ Thumbnail generated successfully for ${video.name}:`,
        thumbnailUrl,
      );

      // Update video with thumbnail - force reactivity
      videos = videos.map((v) =>
        v.id === video.id
          ? { ...v, thumbnailUrl, processing: false, loaded: true }
          : v,
      );

      console.log(`🔄 Updated video ${video.id} with thumbnail`);
    } catch (error) {
      console.error(`❌ Thumbnail generation failed for ${video.name}:`, error);
      console.error("Error details:", error.message);

      // Mark as not processing but keep video name visible
      videos = videos.map((v) =>
        v.id === video.id ? { ...v, processing: false, loaded: true } : v,
      );
    }
  }

  // Simple thumbnail generation using HTML5 video and canvas
  function generateSimpleThumbnail(video) {
    try {
      console.log(`🖼️ Generating simple thumbnail for: ${video.name}`);

      // Mark as processing
      videos = videos.map((v) =>
        v.id === video.id ? { ...v, processing: true } : v,
      );

      // Create a hidden video element
      const videoEl = document.createElement("video");
      videoEl.crossOrigin = "anonymous";
      videoEl.muted = true;
      videoEl.style.display = "none";
      document.body.appendChild(videoEl);

      videoEl.onloadeddata = () => {
        try {
          // Seek to 1 second
          videoEl.currentTime = 1.0;
        } catch (error) {
          console.warn("Could not seek to 1 second, using current frame");
          generateThumbnailFromCurrentFrame();
        }
      };

      videoEl.onseeked = generateThumbnailFromCurrentFrame;
      videoEl.onerror = () => {
        console.error(`❌ Video load error for ${video.name}`);
        cleanup();
        // Mark as not processing, show video name
        videos = videos.map((v) =>
          v.id === video.id ? { ...v, processing: false } : v,
        );
      };

      function generateThumbnailFromCurrentFrame() {
        try {
          // Create canvas
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Set canvas size
          canvas.width = 320;
          canvas.height = (videoEl.videoHeight / videoEl.videoWidth) * 320;

          // Draw video frame to canvas
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

          // Convert to blob URL
          canvas.toBlob(
            (blob) => {
              const thumbnailUrl = URL.createObjectURL(blob);
              console.log(`✅ Simple thumbnail generated for ${video.name}`);

              // Update video with thumbnail
              videos = videos.map((v) =>
                v.id === video.id
                  ? { ...v, thumbnailUrl, processing: false, loaded: true }
                  : v,
              );

              cleanup();
            },
            "image/jpeg",
            0.8,
          );
        } catch (error) {
          console.error(
            `❌ Canvas thumbnail generation failed for ${video.name}:`,
            error,
          );
          cleanup();
          videos = videos.map((v) =>
            v.id === video.id ? { ...v, processing: false } : v,
          );
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
      console.error(
        `❌ Simple thumbnail generation failed for ${video.name}:`,
        error,
      );
      videos = videos.map((v) =>
        v.id === video.id ? { ...v, processing: false } : v,
      );
    }
  }

  // Backwards-compatible background generator (now enqueues)
  function generateThumbnailInBackground(video) {
    // Mark as processing
    videos = videos.map((v) =>
      v.id === video.id ? { ...v, processing: true } : v,
    );
    console.log(`🖼️ Starting thumbnail generation for: ${video.name}`);

    // Try direct generation first, fallback to queue if needed
    generateThumbnailDirect(video);
  }

  // Direct thumbnail generation (simpler approach)
  async function generateThumbnailDirect(video) {
    try {
      console.log(
        `🖼️ [DIRECT] Starting thumbnail generation for: ${video.name}`,
      );

      // Initialize FFmpeg if needed
      if (!ffmpegLoaded && !ffmpegLoading) {
        console.log("🔄 Initializing FFmpeg for thumbnail generation...");
        await initializeFFmpeg();
      }

      // Wait for FFmpeg if it's loading
      while (ffmpegLoading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!ffmpegLoaded) {
        console.warn("⚠️ FFmpeg not available, showing video name only");
        videos = videos.map((v) =>
          v.id === video.id ? { ...v, processing: false } : v,
        );
        return;
      }

      console.log(`🖼️ Generating thumbnail for: ${video.name}`);
      const thumbnailUrl = await ffmpegService.generateThumbnail(
        video.file,
        1.0,
      );
      console.log(`✅ Thumbnail generated: ${thumbnailUrl}`);

      // Update video with thumbnail
      videos = videos.map((v) =>
        v.id === video.id
          ? { ...v, thumbnailUrl, processing: false, loaded: true }
          : v,
      );

      console.log(`🔄 Updated video ${video.name} with thumbnail`);
    } catch (error) {
      console.error(
        `❌ Direct thumbnail generation failed for ${video.name}:`,
        error,
      );

      // Mark as not processing, show video name
      videos = videos.map((v) =>
        v.id === video.id ? { ...v, processing: false } : v,
      );
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
    videosToPreload.forEach((video) => {
      preloadVideo(video);
    });
  }

  function preloadVideo(video) {
    if (!video || !video.url || preloadedVideos.has(video.id)) return;

    console.log(`🔄 Preloading video: ${video.name}`);

    const videoEl = document.createElement("video");
    videoEl.src = video.url;
    videoEl.muted = true;
    videoEl.preload = "auto";
    videoEl.style.display = "none";
    videoEl.style.position = "absolute";
    videoEl.style.top = "-9999px";

    // Enhanced preloading - ensure video is fully ready
    const preloadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`⚠️ Preload timeout for ${video.name}`);
        cleanup();
        resolve(); // Don't reject, just resolve to prevent blocking
      }, 3000); // Further reduced timeout to 3s

      const handleLoadedData = () => {
        clearTimeout(timeout);
        console.log(
          `✅ Video preloaded: ${video.name} (readyState: ${videoEl.readyState})`,
        );

        // Restore saved position if available
        if (savedPositions[video.id] !== undefined) {
          videoEl.currentTime = savedPositions[video.id];
          console.log(
            `⏰ Preload restored position: ${savedPositions[video.id].toFixed(2)}s`,
          );
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
        videoEl.removeEventListener("loadeddata", handleLoadedData);
        videoEl.removeEventListener("error", handleError);
        videoEl.removeEventListener("canplaythrough", handleLoadedData);
      };

      videoEl.addEventListener("loadeddata", handleLoadedData);
      videoEl.addEventListener("canplaythrough", handleLoadedData);
      videoEl.addEventListener("error", handleError);
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
          videoEl.src = "";
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
      console.log(
        `🎯 Found preloaded video for ${videoId}, readyState: ${preloadedVideo.readyState}`,
      );
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
    if (video.url.startsWith("blob:")) {
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
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(event) {
    if (!isReorderingMode || draggedIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event, targetIndex) {
    if (!isReorderingMode || draggedIndex === null) return;
    event.preventDefault();

    const draggedVideo = videos[draggedIndex];
    const newVideos = [...videos];

    // Remove dragged video
    newVideos.splice(draggedIndex, 1);

    // Insert at new position
    const insertIndex =
      draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    newVideos.splice(insertIndex, 0, draggedVideo);

    videos = newVideos;

    // Update current video index if necessary
    if (draggedIndex === currentVideoIndex) {
      currentVideoIndex = insertIndex;
    } else if (
      draggedIndex < currentVideoIndex &&
      insertIndex >= currentVideoIndex
    ) {
      currentVideoIndex--;
    } else if (
      draggedIndex > currentVideoIndex &&
      insertIndex <= currentVideoIndex
    ) {
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
      if (file.type.startsWith("video/")) {
        const video = {
          id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url: null,
          file: file,
          thumbnailUrl: null,
          loaded: false,
          processing: true,
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
          videos = videos.map((v) =>
            v.id === video.id
              ? { ...v, thumbnailUrl, loaded: true, processing: false }
              : v,
          );
        } catch (error) {
          console.error(
            "Error generating thumbnail for",
            file.name,
            ":",
            error,
          );

          // Mark as loaded even if thumbnail generation failed
          videos = videos.map((v) =>
            v.id === video.id ? { ...v, loaded: true, processing: false } : v,
          );
        }
      }
    }

    showInsertionInterface = false;
    insertionIndex = null;
    event.target.value = "";
  }

  function handleVideoPositionSave(event) {
    try {
      const { id, position } = event.detail;

      // Validate input
      if (!id || typeof position !== "number" || position < 0) {
        console.warn("⚠️ Invalid position save data:", { id, position });
        return;
      }

      savedPositions[id] = position;
      console.log(
        `💾 Video position saved: ${position.toFixed(2)}s for video ID: ${id}`,
      );
    } catch (error) {
      console.error("❌ Error saving video position:", error);
    }
  }

  // Handle video errors from VideoPlayer
  function handleVideoError(event) {
    const { error, video } = event.detail;
    console.error(
      `❌ Video error for ${video?.name || "unknown video"}:`,
      error,
    );

    // Could implement recovery strategies here:
    // - Try to reload the video
    // - Skip to next video
    // - Show user notification
  }

  // Test function to verify everything is working
  function runSystemTest() {
    console.log("🧪 Running system test...");
    console.log("📊 System Status:");
    console.log(`  - FFmpeg Loaded: ${ffmpegLoaded}`);
    console.log(`  - FFmpeg Loading: ${ffmpegLoading}`);
    console.log(`  - Videos Loaded: ${videos.length}`);
    console.log(`  - Current Video Index: ${currentVideoIndex}`);
    console.log(`  - Audio URL: ${audioUrl || "None"}`);
    console.log(`  - Audio Duration: ${duration.toFixed(2)}s`);
    console.log(`  - Current Time: ${currentTime.toFixed(2)}s`);
    console.log(`  - Is Playing: ${isPlaying}`);
    console.log(`  - Markers: ${markers.length}`);
    console.log(`  - Markers Per Shot: ${markersPerShot}`);
    console.log(`  - Marker Count: ${markerCount}`);
    console.log(`  - Saved Positions:`, savedPositions);

    if (videos.length > 0) {
      console.log("🎬 Video Details:");
      videos.forEach((video, index) => {
        console.log(
          `  ${index + 1}. ${video.name} - Loaded: ${video.loaded}, Processing: ${video.processing || false}`,
        );
      });
    }

    console.log("✅ System test complete");
  }

  // Audio playback is controlled by parent AudioTimeline
</script>

<div class="video-editor">
  <input
    type="file"
    accept="video/*"
    multiple
    bind:this={videoFileInput}
    onchange={handleVideoFiles}
    style="display: none;"
  />
  <!-- Visual Feedback Overlay for Switching -->
  {#if lastSwitchTime > 0 && Date.now() - lastSwitchTime < 300}
    <div class="switch-flash"></div>
  {/if}

  <div class="editor-header">
    <h3>Video Sequencer</h3>
    <div class="sync-status">
      <div class="status-indicator {isPlaying ? 'pulse' : ''}"></div>
      <span class="time-display">
        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60)
          .toString()
          .padStart(2, "0")} /
        {Math.floor(duration / 60)}:{Math.floor(duration % 60)
          .toString()
          .padStart(2, "0")}
      </span>
    </div>
  </div>

  <div class="main-content">
    <!-- Left Column: Player -->
    <div class="player-section">
      <div class="main-player-frame">
        <VideoPlayer
          bind:this={videoPlayerComponent}
          {currentVideo}
          playing={isPlaying}
          {savedPositions}
          {getPreloadedVideo}
          playbackRate={currentVideoSpeed}
          on:saveposition={handleVideoPositionSave}
          on:videoerror={handleVideoError}
        />
      </div>

      <!-- Markers Display (Timeline) -->
      <div class="timeline-wrapper">
        <Markers
          markers={audioMarkers}
          {currentTime}
          {duration}
          playing={isPlaying}
        />
      </div>
    </div>

    <!-- Right Column: Controls & Grid -->
    <div class="sidebar-section">
      <!-- Control Panel -->
      <div class="control-panel glass-panel">
        <div class="panel-header">
          <h4>Auto-Edit Controls</h4>
          <div class="live-badge {isPlaying ? 'active' : ''}">LIVE</div>
        </div>

        <div class="control-group">
          <label for="markers-slider">
            <span>Switch Frequency</span>
            <span class="value-badge"
              >{markersPerShot} {markersPerShot === 1 ? "beat" : "beats"}</span
            >
          </label>
          <div class="slider-container">
            <input
              id="markers-slider"
              type="range"
              min="1"
              max="16"
              bind:value={markersPerShot}
              class="premium-slider"
            />
            <div
              class="slider-track-fill"
              style="width: {((markersPerShot - 1) / 15) * 100}%"
            ></div>
          </div>
          <p class="control-hint">
            Switches video every {markersPerShot} marker{markersPerShot > 1
              ? "s"
              : ""}
          </p>
        </div>

        <div class="action-buttons">
          <button class="btn-premium primary" onclick={handleVideoUpload}>
            <span class="icon">📁</span> Import Clips
          </button>

          <button
            class="btn-premium {isReorderingMode ? 'active' : 'secondary'}"
            onclick={toggleReorderingMode}
          >
            <span class="icon">⇄</span>
            {isReorderingMode ? "Done Reordering" : "Reorder Clips"}
          </button>
        </div>
      </div>

      <!-- Video Grid -->
      <div class="clips-panel glass-panel">
        <div class="panel-header">
          <h4>Clip Library <span class="count-badge">{videos.length}</span></h4>
        </div>

        <div class="video-grid-scroll">
          {#if videos.length === 0}
            <div class="empty-state">
              <div class="empty-icon">🎬</div>
              <p>No clips added</p>
              <button class="btn-text" onclick={handleVideoUpload}
                >Import videos to start</button
              >
            </div>
          {:else}
            <div class="video-grid">
              {#each videos as video, index}
                <!-- Insertion point -->
                {#if isReorderingMode && index === 0}
                  <div
                    class="insertion-point"
                    onclick={() => handleInsertionClick(index)}
                    onkeydown={(e) =>
                      e.key === "Enter" && handleInsertionClick(index)}
                    tabindex="0"
                    role="button"
                    aria-label="Insert video before position {index + 1}"
                  >
                    <span>+</span>
                  </div>
                {/if}

                <!-- Video Thumbnail -->
                <div
                  class="video-card {currentVideoIndex === index
                    ? 'playing'
                    : ''} {isReorderingMode ? 'draggable' : ''}"
                  draggable={isReorderingMode}
                  ondragstart={(e) => handleDragStart(e, index)}
                  ondragover={handleDragOver}
                  ondrop={(e) => handleDrop(e, index)}
                  onclick={() =>
                    !isReorderingMode && (currentVideoIndex = index)}
                  onkeydown={(e) =>
                    !isReorderingMode &&
                    e.key === "Enter" &&
                    (currentVideoIndex = index)}
                  role="button"
                  tabindex="0"
                  aria-label="Video clip {index + 1}: {video.name}"
                >
                  <div class="thumbnail-wrapper">
                    {#if video.processing}
                      <div class="thumbnail-loading">
                        <div class="spinner-ring"></div>
                      </div>
                    {:else if video.thumbnailUrl}
                      <img
                        src={video.thumbnailUrl}
                        alt="Thumbnail for {video.name}"
                        class="thumbnail-image"
                      />
                    {:else}
                      <div class="thumbnail-placeholder">
                        <span>📹</span>
                      </div>
                    {/if}

                    {#if currentVideoIndex === index}
                      <div class="playing-overlay">
                        <div class="equalizer-bars">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <div class="card-info">
                    <span class="clip-name" title={video.name}
                      >{video.name}</span
                    >
                    <span class="clip-index">#{index + 1}</span>
                  </div>

                  {#if isReorderingMode}
                    <div class="drag-handle">⋮⋮</div>
                    <button
                      class="delete-btn"
                      onclick={(e) => {
                        e.stopPropagation();
                        deleteVideo(index);
                      }}
                      title="Remove clip"
                    >
                      ×
                    </button>
                  {/if}
                </div>

                <!-- Insertion point -->
                {#if isReorderingMode}
                  <button
                    class="insertion-point"
                    onclick={() => handleInsertionClick(index + 1)}
                    aria-label="Insert video after position {index + 1}"
                  >
                    <span>+</span>
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Insertion Interface Modal -->
  {#if showInsertionInterface}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-overlay"
      role="presentation"
      onclick={() => (showInsertionInterface = false)}
    >
      <div
        class="insertion-modal glass-panel"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
      >
        <h4>Insert Video at Position {insertionIndex + 1}</h4>
        <p>Select video files to insert at this position:</p>

        <label class="file-drop-zone">
          <input
            type="file"
            accept="video/*"
            multiple
            onchange={handleInsertionVideoSelect}
          />
          <span class="drop-icon">📥</span>
          <span class="drop-text">Click to browse or drop files here</span>
        </label>

        <div class="modal-actions">
          <button
            class="btn-premium secondary"
            onclick={() => (showInsertionInterface = false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(:root) {
    --primary-color: #00f2ea;
    --primary-glow: rgba(0, 242, 234, 0.4);
    --accent-color: #ff0055;
    --bg-dark: #0a0a0a;
    --bg-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --text-main: #ffffff;
    --text-muted: #888888;
  }

  .video-editor {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    color: var(--text-main);
    position: relative;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10px;
  }

  .editor-header h3 {
    margin: 0;
    font-weight: 300;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 1.2rem;
    background: linear-gradient(90deg, #fff, #888);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .main-content {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 24px;
    height: calc(100vh - 200px); /* Adjust based on layout */
    min-height: 500px;
  }

  /* Left Column */
  .player-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .main-player-frame {
    width: 100%;
    aspect-ratio: 16/9;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--glass-border);
  }

  .timeline-wrapper {
    background: var(--bg-panel);
    border-radius: 8px;
    padding: 10px;
    border: 1px solid var(--glass-border);
  }

  /* Right Column */
  .sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow: hidden;
  }

  .glass-panel {
    background: var(--bg-panel);
    backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .panel-header h4 {
    margin: 0;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
  }

  /* Controls */
  .control-group {
    margin-bottom: 20px;
  }

  .control-group label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 0.9rem;
  }

  .value-badge {
    background: var(--primary-glow);
    color: var(--primary-color);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .slider-container {
    position: relative;
    height: 20px;
    display: flex;
    align-items: center;
  }

  .premium-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    outline: none;
    z-index: 2;
    position: relative;
  }

  .premium-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--primary-color);
    box-shadow: 0 0 10px var(--primary-glow);
    cursor: pointer;
    transition: transform 0.1s;
  }

  .premium-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .slider-track-fill {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 4px;
    background: var(--primary-color);
    border-radius: 2px;
    pointer-events: none;
    z-index: 1;
  }

  .control-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 8px;
  }

  .action-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .btn-premium {
    border: none;
    border-radius: 8px;
    padding: 10px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .btn-premium.primary {
    background: linear-gradient(135deg, var(--primary-color), #00a8a4);
    color: #000;
    box-shadow: 0 4px 15px rgba(0, 242, 234, 0.2);
  }

  .btn-premium.primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 242, 234, 0.3);
  }

  .btn-premium.secondary {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-main);
    border: 1px solid var(--glass-border);
  }

  .btn-premium.secondary:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-premium.active {
    background: var(--accent-color);
    color: white;
    box-shadow: 0 4px 15px rgba(255, 0, 85, 0.3);
  }

  /* Video Grid */
  .clips-panel {
    flex: 1;
    overflow: hidden;
    padding-right: 5px; /* Space for scrollbar */
  }

  .count-badge {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 0.7rem;
    margin-left: 8px;
  }

  .video-grid-scroll {
    flex: 1;
    overflow-y: auto;
    padding-right: 10px;
  }

  .video-grid-scroll::-webkit-scrollbar {
    width: 4px;
  }

  .video-grid-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  .video-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .video-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
    text-align: left;
    position: relative;
    width: 100%;
  }

  .video-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .video-card.playing {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px var(--primary-glow);
  }

  .thumbnail-wrapper {
    aspect-ratio: 16/9;
    background: #111;
    position: relative;
  }

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .playing-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .equalizer-bars {
    display: flex;
    gap: 3px;
    height: 16px;
    align-items: flex-end;
  }

  .equalizer-bars span {
    width: 3px;
    background: var(--primary-color);
    animation: equalize 0.8s infinite ease-in-out;
  }

  .equalizer-bars span:nth-child(2) {
    animation-delay: 0.1s;
  }
  .equalizer-bars span:nth-child(3) {
    animation-delay: 0.2s;
  }

  @keyframes equalize {
    0%,
    100% {
      height: 20%;
    }
    50% {
      height: 100%;
    }
  }

  .card-info {
    padding: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .clip-name {
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80%;
  }

  .clip-index {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  /* Drag & Drop */
  .video-card.draggable {
    cursor: grab;
  }

  .drag-handle {
    position: absolute;
    top: 4px;
    right: 4px;
    color: white;
    background: rgba(0, 0, 0, 0.5);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 10px;
    cursor: grab;
  }

  .delete-btn {
    position: absolute;
    top: 4px;
    left: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 0, 0, 0.7);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .video-card:hover .delete-btn {
    opacity: 1;
  }

  .insertion-point {
    grid-column: span 2;
    height: 40px;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .insertion-point:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: rgba(0, 242, 234, 0.05);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--text-muted);
    text-align: center;
  }

  .empty-icon {
    font-size: 2rem;
    margin-bottom: 10px;
    opacity: 0.5;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--primary-color);
    text-decoration: underline;
    cursor: pointer;
    margin-top: 5px;
  }

  /* Sync Status */
  .sync-status {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--glass-border);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #444;
  }

  .status-indicator.pulse {
    background: var(--primary-color);
    box-shadow: 0 0 8px var(--primary-glow);
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  .time-display {
    font-family: "Roboto Mono", monospace;
    font-size: 0.85rem;
    color: #ccc;
  }

  .live-badge {
    font-size: 0.7rem;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    background: #333;
    color: #666;
  }

  .live-badge.active {
    background: var(--accent-color);
    color: white;
    box-shadow: 0 0 10px rgba(255, 0, 85, 0.4);
  }

  /* Flash Effect */
  .switch-flash {
    position: absolute;
    inset: 0;
    background: white;
    opacity: 0.1;
    pointer-events: none;
    z-index: 100;
    animation: flash 0.3s ease-out forwards;
  }

  @keyframes flash {
    0% {
      opacity: 0.2;
    }
    100% {
      opacity: 0;
    }
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .insertion-modal {
    width: 90%;
    max-width: 400px;
    background: #1a1a1a;
  }

  .file-drop-zone {
    border: 2px dashed var(--glass-border);
    border-radius: 8px;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    margin: 20px 0;
  }

  .file-drop-zone:hover {
    border-color: var(--primary-color);
    background: rgba(0, 242, 234, 0.05);
  }

  .file-drop-zone input {
    display: none;
  }

  .drop-icon {
    font-size: 2rem;
    margin-bottom: 10px;
  }

  .drop-text {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .main-content {
      grid-template-columns: 1fr;
      height: auto;
    }

    .sidebar-section {
      height: 500px;
    }
  }
</style>
