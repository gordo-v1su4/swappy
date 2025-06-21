<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // Props using Svelte 5 syntax
  let {
    currentVideo = null,
    playing = false,
    savedPositions = {},
    getPreloadedVideo = null // Function to get preloaded video elements
  } = $props();
  
  // Dual video element system for seamless switching
  let primaryVideo = $state();
  let secondaryVideo = $state();
  let compositeCanvas = $state();
  let currentActiveVideo = $state('primary'); // 'primary' or 'secondary'
  let lastSavedPosition = $state(-1);
  let wasPlaying = $state(false);
  let currentVideoId = $state(null);
  const dispatch = createEventDispatcher();
  
  // Canvas composition state
  let canvasContext = $state();
  let animationFrame = $state();
  let isTransitioning = $state(false);
  let transitionProgress = $state(0);
  let transitionDuration = 300; // ms
  let transitionStartTime = $state(0);
  let useCanvas = $state(false); // Toggle to disable canvas and use regular video elements - DISABLED FOR DEBUGGING
  
  // Get the currently active video element using derived state
  let activeVideoElement = $derived(currentActiveVideo === 'primary' ? primaryVideo : secondaryVideo);
  let inactiveVideoElement = $derived(currentActiveVideo === 'primary' ? secondaryVideo : primaryVideo);
  
  // Effect to handle video changes - SIMPLIFIED
  $effect(() => {
    if (currentVideo && currentVideo.id !== currentVideoId && primaryVideo && secondaryVideo) {
      handleSimpleVideoChange(currentVideo);
    }
  });
  
  async function handleVideoChange(video) {
    if (!video || !video.url) {
      console.warn('⚠️ Invalid video for change:', video);
      return;
    }
    
    if (!primaryVideo) {
      console.warn('⚠️ Primary video element not ready');
      return;
    }
    
    // If secondary video isn't ready yet, we'll use primary video only
    if (!secondaryVideo) {
      console.log('ℹ️ Secondary video not ready, using primary video only');
      
      try {
        const wasCurrentlyPlaying = primaryVideo && !primaryVideo.paused;
        
        // Load directly into primary video
        primaryVideo.src = video.url;
        console.log('📝 Set primary video src to:', video.url);
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            primaryVideo.removeEventListener('loadeddata', handleLoadedData);
            primaryVideo.removeEventListener('error', handleError);
            reject(new Error('Primary video load timeout'));
          }, 10000);
          
          const handleLoadedData = () => {
            clearTimeout(timeout);
            primaryVideo.removeEventListener('loadeddata', handleLoadedData);
            primaryVideo.removeEventListener('error', handleError);
            console.log('✅ Primary video loaded successfully');
            resolve();
          };
          
          const handleError = (error) => {
            clearTimeout(timeout);
            primaryVideo.removeEventListener('loadeddata', handleLoadedData);
            primaryVideo.removeEventListener('error', handleError);
            console.error('❌ Primary video load error:', error);
            reject(new Error(`Failed to load video: ${error.message || 'Unknown error'}`));
          };
          
          primaryVideo.addEventListener('loadeddata', handleLoadedData);
          primaryVideo.addEventListener('error', handleError);
          primaryVideo.load();
        });
        
        // Restore saved position if available
        if (savedPositions[video.id] !== undefined) {
          primaryVideo.currentTime = savedPositions[video.id];
          console.log(`⏰ Restored position: ${savedPositions[video.id].toFixed(2)}s`);
        } else {
          primaryVideo.currentTime = 0;
        }
        
        currentVideoId = video.id;
        currentActiveVideo = 'primary';
        
        // Resume playback if it was playing before
        if (wasCurrentlyPlaying && playing) {
          try {
            await primaryVideo.play();
            console.log('▶️ Primary video playback resumed');
          } catch (playError) {
            if (playError.name === 'AbortError') {
              console.log('🔄 Primary video play was interrupted by new load (normal during switching)');
            } else {
              throw playError; // Re-throw other errors
            }
          }
        }
        
        console.log('✅ Primary-only video switch completed');
        
      } catch (error) {
        console.error('❌ Error during primary-only video change:', error);
        dispatch('videoerror', { error: error.message, video });
      }
      
      return;
    }
    
    try {
      console.log('🔄 Switching to video:', video.name, 'URL:', video.url);
      
      const wasCurrentlyPlaying = activeVideoElement && !activeVideoElement.paused;
      
      // Check if we have a preloaded video for seamless switching
      const preloadedVideo = getPreloadedVideo ? getPreloadedVideo(video.id) : null;
      
      if (preloadedVideo && preloadedVideo.readyState >= 2) {
        console.log('⚡ Using preloaded video for instant switch:', video.name);
        
        // Copy the preloaded video state to the inactive video element
        inactiveVideoElement.src = preloadedVideo.src;
        
        // Wait for the inactive video to be ready
        if (inactiveVideoElement.readyState < 2) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              inactiveVideoElement.removeEventListener('loadeddata', handleReady);
              reject(new Error('Preload copy timeout'));
            }, 5000);
            
            const handleReady = () => {
              clearTimeout(timeout);
              inactiveVideoElement.removeEventListener('loadeddata', handleReady);
              resolve();
            };
            inactiveVideoElement.addEventListener('loadeddata', handleReady);
            inactiveVideoElement.load();
          });
        }
        
        // Restore saved position if available
        if (savedPositions[video.id] !== undefined) {
          inactiveVideoElement.currentTime = savedPositions[video.id];
          console.log(`⏰ Restored position: ${savedPositions[video.id].toFixed(2)}s`);
        } else {
          inactiveVideoElement.currentTime = preloadedVideo.currentTime;
        }
        
        // Start canvas transition for seamless switching (only if using canvas)
        if (useCanvas) {
          startVideoTransition();
        }
        
        // Switch active video element
        const previousActive = currentActiveVideo;
        currentActiveVideo = currentActiveVideo === 'primary' ? 'secondary' : 'primary';
        
        // If video was playing, start the new active video immediately
        if (wasCurrentlyPlaying && playing) {
          try {
            await activeVideoElement.play();
          } catch (playError) {
            if (playError.name === 'AbortError') {
              console.log('🔄 Seamless video play was interrupted by new load (normal during switching)');
            } else {
              throw playError; // Re-throw other errors
            }
          }
        }
        
        // Pause the now-inactive video
        if (inactiveVideoElement && !inactiveVideoElement.paused) {
          inactiveVideoElement.pause();
        }
        
        console.log(`✅ Seamless switch completed: ${previousActive} -> ${currentActiveVideo}`);
        
      } else {
        console.log('🔄 Loading video directly (no preload available)');
        
        // Load video into inactive element
        inactiveVideoElement.src = video.url;
        console.log('📝 Set inactive video src to:', video.url);
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            inactiveVideoElement.removeEventListener('loadeddata', handleLoadedData);
            inactiveVideoElement.removeEventListener('error', handleError);
            reject(new Error('Video load timeout'));
          }, 10000);
          
          const handleLoadedData = () => {
            clearTimeout(timeout);
            inactiveVideoElement.removeEventListener('loadeddata', handleLoadedData);
            inactiveVideoElement.removeEventListener('error', handleError);
            console.log('✅ Inactive video loaded successfully');
            resolve();
          };
          
          const handleError = (error) => {
            clearTimeout(timeout);
            inactiveVideoElement.removeEventListener('loadeddata', handleLoadedData);
            inactiveVideoElement.removeEventListener('error', handleError);
            console.error('❌ Inactive video load error:', error);
            reject(new Error(`Failed to load video: ${error.message || 'Unknown error'}`));
          };
          
          inactiveVideoElement.addEventListener('loadeddata', handleLoadedData);
          inactiveVideoElement.addEventListener('error', handleError);
          inactiveVideoElement.load();
        });
        
        console.log('✅ Video loaded successfully:', video.name);
        
        // Restore saved position
        if (savedPositions[video.id] !== undefined) {
          inactiveVideoElement.currentTime = savedPositions[video.id];
          console.log(`⏰ Restored position: ${savedPositions[video.id].toFixed(2)}s`);
        } else {
          inactiveVideoElement.currentTime = 0;
        }
        
        // Start canvas transition for seamless switching (only if using canvas)
        if (useCanvas) {
          startVideoTransition();
        }
        
        // Switch to the newly loaded video
        const previousActive = currentActiveVideo;
        currentActiveVideo = currentActiveVideo === 'primary' ? 'secondary' : 'primary';
        console.log(`🔄 Switched active video: ${previousActive} -> ${currentActiveVideo}`);
        
        // Resume playback if it was playing before
        if (wasCurrentlyPlaying && playing) {
          try {
            await activeVideoElement.play();
          } catch (playError) {
            if (playError.name === 'AbortError') {
              console.log('🔄 Direct load video play was interrupted by new load (normal during switching)');
            } else {
              throw playError; // Re-throw other errors
            }
          }
        }
        
        // Pause the now-inactive video
        if (inactiveVideoElement && !inactiveVideoElement.paused) {
          inactiveVideoElement.pause();
        }
      }
      
      currentVideoId = video.id;
      
    } catch (error) {
      console.error('❌ Error during video change:', error);
      dispatch('videoerror', { error: error.message, video });
    }
  }
  
  // Effect to handle play state changes
  $effect(() => {
    if (activeVideoElement && playing !== undefined) {
      handlePlayStateChange(playing);
    }
  });
  
  async function handlePlayStateChange(shouldPlay) {
    if (!activeVideoElement || !currentVideo) return;
    
    try {
      if (shouldPlay && !wasPlaying) {
        // Validate video is ready before playing
        if (activeVideoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          try {
            await activeVideoElement.play();
            wasPlaying = true;
            console.log('▶️ Video playback started');
          } catch (playError) {
            if (playError.name === 'AbortError') {
              console.log('🔄 Play request was interrupted by new load (this is normal during video switching)');
              return; // Don't treat this as an error
            }
            throw playError; // Re-throw other errors
          }
        } else {
          console.warn('⚠️ Video not ready for playback, waiting...');
          // Wait for video to be ready
          await new Promise((resolve) => {
            const handleCanPlay = () => {
              activeVideoElement.removeEventListener('canplay', handleCanPlay);
              resolve();
            };
            activeVideoElement.addEventListener('canplay', handleCanPlay);
          });
          try {
            await activeVideoElement.play();
            wasPlaying = true;
            console.log('▶️ Video playback started (after waiting)');
          } catch (playError) {
            if (playError.name === 'AbortError') {
              console.log('🔄 Play request was interrupted by new load (this is normal during video switching)');
              return; // Don't treat this as an error
            }
            throw playError; // Re-throw other errors
          }
        }
      } else if (!shouldPlay && wasPlaying) {
        // Pause and save position
        activeVideoElement.pause();
        wasPlaying = false;
        console.log('⏸️ Video playback paused');
        
        // Save current position when pausing (only if position changed significantly)
        if (currentVideo && Math.abs(activeVideoElement.currentTime - lastSavedPosition) > 0.1) {
          lastSavedPosition = activeVideoElement.currentTime;
          dispatch('saveposition', {
            id: currentVideo.id,
            position: activeVideoElement.currentTime
          });
          console.log(`💾 Position saved: ${activeVideoElement.currentTime.toFixed(2)}s`);
        }
      }
    } catch (error) {
      console.error('❌ Error during play state change:', error);
      wasPlaying = false;
      dispatch('videoerror', {
        error: `Playback error: ${error.message}`,
        video: currentVideo
      });
    }
  }
  
  // Removed handleEnded - using native loop attribute instead
  
  onMount(() => {
    // Only initialize canvas if we're using it
    if (useCanvas) {
      setTimeout(() => {
        if (compositeCanvas) {
          canvasContext = compositeCanvas.getContext('2d');
          console.log('Canvas context initialized:', !!canvasContext);
          
          // Set canvas size to match container
          resizeCanvas();
          
          // Start the rendering loop
          startCanvasRendering();
          
          // Add resize listener
          window.addEventListener('resize', resizeCanvas);
        }
      }, 100);
    }
    
    if (primaryVideo && currentVideo) {
      console.log('🎬 Initial video load:', currentVideo.name, 'URL:', currentVideo.url);
      primaryVideo.src = currentVideo.url;
      currentVideoId = currentVideo.id;
      currentActiveVideo = 'primary';
      
      // Ensure the primary video is visible initially
      primaryVideo.addEventListener('loadeddata', () => {
        console.log('✅ Initial video loaded successfully');
        // Force canvas to start drawing once video is ready
        if (!animationFrame) {
          startCanvasRendering();
        }
      });
      
      primaryVideo.load();
    }
  });
  
  onDestroy(() => {
    // Clean up animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    // Remove resize listener
    window.removeEventListener('resize', resizeCanvas);
  });
  
  // Canvas rendering functions
  function resizeCanvas() {
    if (!compositeCanvas) return;
    
    // Get the container dimensions
    const container = compositeCanvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 450;
      
      // Set canvas size
      compositeCanvas.width = width;
      compositeCanvas.height = height;
      
      // Also set CSS size to match
      compositeCanvas.style.width = width + 'px';
      compositeCanvas.style.height = height + 'px';
      
      console.log('Canvas resized to:', width, 'x', height);
    }
  }
  
  function startCanvasRendering() {
    if (!canvasContext || !useCanvas) return;
    
    function render() {
      if (useCanvas) {
        drawVideoToCanvas();
        animationFrame = requestAnimationFrame(render);
      }
    }
    
    render();
  }
  
  function drawVideoToCanvas() {
    if (!useCanvas) return; // Don't render if canvas is disabled
    
    if (!canvasContext || !compositeCanvas) {
      console.warn('Canvas or context not ready');
      return;
    }
    
    const canvas = compositeCanvas;
    const ctx = canvasContext;
    
    // Clear the canvas with a test color to verify canvas is working
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (isTransitioning) {
      // During transition, blend both videos
      drawTransition(ctx, canvas);
    } else {
      // Normal playback, draw active video
      const activeVideo = activeVideoElement;
      if (activeVideo && activeVideo.readyState >= 2) {
        // Only log once when video starts drawing
        if (!activeVideo._canvasDrawing) {
          console.log('✅ Started drawing video frame:', activeVideo.videoWidth, 'x', activeVideo.videoHeight);
          activeVideo._canvasDrawing = true;
        }
        drawVideoFrame(ctx, canvas, activeVideo, 1.0);
      } else {
        // Debug: show why video isn't drawing
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(10, 10, 100, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(`No video ready`, 15, 30);
        ctx.fillText(`ReadyState: ${activeVideo?.readyState || 'none'}`, 15, 45);
      }
    }
  }
  
  function drawVideoFrame(ctx, canvas, video, opacity = 1.0) {
    if (!video || video.readyState < 2) return;
    
    // Calculate aspect ratio and positioning
    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (videoAspect > canvasAspect) {
      // Video is wider - fit to width
      drawWidth = canvas.width;
      drawHeight = canvas.width / videoAspect;
      drawX = 0;
      drawY = (canvas.height - drawHeight) / 2;
    } else {
      // Video is taller - fit to height
      drawHeight = canvas.height;
      drawWidth = canvas.height * videoAspect;
      drawX = (canvas.width - drawWidth) / 2;
      drawY = 0;
    }
    
    // Set opacity for blending
    ctx.globalAlpha = opacity;
    
    // Draw the video frame
    try {
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    } catch (error) {
      // Video might not be ready yet
      console.warn('Canvas draw error:', error.message);
    }
    
    // Reset alpha
    ctx.globalAlpha = 1.0;
  }
  
  function drawTransition(ctx, canvas) {
    const now = performance.now();
    const elapsed = now - transitionStartTime;
    transitionProgress = Math.min(elapsed / transitionDuration, 1.0);
    
    const oldVideo = currentActiveVideo === 'primary' ? secondaryVideo : primaryVideo;
    const newVideo = activeVideoElement;
    
    // Draw old video with decreasing opacity
    if (oldVideo && oldVideo.readyState >= 2) {
      drawVideoFrame(ctx, canvas, oldVideo, 1.0 - transitionProgress);
    }
    
    // Draw new video with increasing opacity
    if (newVideo && newVideo.readyState >= 2) {
      drawVideoFrame(ctx, canvas, newVideo, transitionProgress);
    }
    
    // End transition when complete
    if (transitionProgress >= 1.0) {
      isTransitioning = false;
      console.log('✅ Canvas transition completed');
    }
  }
  
  function startVideoTransition() {
    isTransitioning = true;
    transitionProgress = 0;
    transitionStartTime = performance.now();
    console.log('🎬 Starting canvas transition');
  }
  
  // Export method to get current video time
  export function getCurrentTime() {
    return activeVideoElement ? activeVideoElement.currentTime : null;
  }
  
  // SIMPLIFIED video change - just load into inactive element and switch
  async function handleSimpleVideoChange(video) {
    if (!video || !video.url || !primaryVideo || !secondaryVideo) return;
    
    console.log('🎬 Simple video change to:', video.name);
    
    try {
      // Always load the new video into the inactive element
      const targetElement = inactiveVideoElement;
      const wasPlaying = activeVideoElement && !activeVideoElement.paused;
      
      // Set the source and load
      targetElement.src = video.url;
      
      // Wait for it to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          targetElement.removeEventListener('loadeddata', handleLoaded);
          targetElement.removeEventListener('error', handleError);
          resolve(); // Don't reject, just continue
        }, 3000);
        
        const handleLoaded = () => {
          clearTimeout(timeout);
          targetElement.removeEventListener('loadeddata', handleLoaded);
          targetElement.removeEventListener('error', handleError);
          resolve();
        };
        
        const handleError = () => {
          clearTimeout(timeout);
          targetElement.removeEventListener('loadeddata', handleLoaded);
          targetElement.removeEventListener('error', handleError);
          resolve(); // Don't reject, just continue
        };
        
        targetElement.addEventListener('loadeddata', handleLoaded);
        targetElement.addEventListener('error', handleError);
        targetElement.load();
      });
      
      // Smart position restoration - avoid jumps during looping
      if (savedPositions[video.id] !== undefined) {
        const savedPos = savedPositions[video.id];
        const videoDuration = targetElement.duration || 0;
        
        // If the saved position is near the end and we're looping, start from beginning
        if (videoDuration > 0 && savedPos > videoDuration - 1) {
          targetElement.currentTime = 0;
          console.log(`🔄 Video was near end, starting fresh to avoid loop jump`);
          // Clear the saved position since we're starting fresh
          delete savedPositions[video.id];
        } else {
          targetElement.currentTime = savedPos;
          console.log(`⏰ Restored position: ${savedPos.toFixed(2)}s`);
        }
      } else {
        targetElement.currentTime = 0;
      }
      
      // INSTANT SWITCH with precise timing
      const previousElement = activeVideoElement;
      currentActiveVideo = currentActiveVideo === 'primary' ? 'secondary' : 'primary';
      currentVideoId = video.id;
      
      // Start playback immediately if it was playing
      if (wasPlaying && playing) {
        try {
          // Pause the old video immediately to avoid conflicts
          if (previousElement && !previousElement.paused) {
            previousElement.pause();
          }
          
          // Start the new video immediately
          await activeVideoElement.play();
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.warn('Play error:', error.message);
          }
        }
      }
      
      console.log('✅ Simple video switch completed');
      
    } catch (error) {
      console.error('❌ Simple video change error:', error);
    }
  }
</script>

<div class="video-player">
  {#if currentVideo}
    <!-- Canvas for seamless video composition -->
    <canvas
      bind:this={compositeCanvas}
      class="composite-canvas"
    ></canvas>
    
    <!-- Hidden video elements for processing -->
    <div class="hidden-videos">
      <video
        bind:this={primaryVideo}
        class="hidden-video {currentActiveVideo === 'primary' ? 'active' : 'inactive'}"
        aria-label="Primary video buffer"
        muted
        preload="auto"
        crossorigin="anonymous"
        loop
      >
        <track kind="captions" src="" label="No captions available" default />
      </video>
      
      <video
        bind:this={secondaryVideo}
        class="hidden-video {currentActiveVideo === 'secondary' ? 'active' : 'inactive'}"
        aria-label="Secondary video buffer"
        muted
        preload="auto"
        crossorigin="anonymous"
        loop
      >
        <track kind="captions" src="" label="No captions available" default />
      </video>
    </div>
  {:else}
    <div class="no-video">No video selected</div>
  {/if}
</div>

<style>
  .video-player {
    width: 100%;
    height: 100%;
    background-color: #121212;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  .composite-canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: #121212;
    display: block;
  }
  
  .hidden-videos {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  
  .hidden-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    top: 0;
    left: 0;
    /* transition: opacity 0.1s ease; */ /* Disabled for instant switching */
  }
  
  .hidden-video.active {
    opacity: 1;
    z-index: 2;
  }
  
  .hidden-video.inactive {
    opacity: 0;
    z-index: 1;
  }
  
  .composite-canvas {
    z-index: 3;
    display: none; /* Hidden for debugging */
  }
  
  .no-video {
    color: #666;
    font-size: 18px;
    z-index: 3;
  }
</style>
