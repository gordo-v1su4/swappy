<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  export let currentVideo = null;
  export let playing = false;
  export let savedPositions = {};
  export let getPreloadedVideo = null; // Function to get preloaded video elements
  
  // Dual video element system for seamless switching
  let primaryVideo;
  let secondaryVideo;
  let currentActiveVideo = 'primary'; // 'primary' or 'secondary'
  let lastSavedPosition = -1;
  let wasPlaying = false;
  let currentVideoId = null;
  const dispatch = createEventDispatcher();
  
  // Get the currently active video element
  $: activeVideoElement = currentActiveVideo === 'primary' ? primaryVideo : secondaryVideo;
  $: inactiveVideoElement = currentActiveVideo === 'primary' ? secondaryVideo : primaryVideo;
  
  $: if (currentVideo && currentVideo.id !== currentVideoId && primaryVideo) {
    handleVideoChange(currentVideo);
  }
  
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
          await primaryVideo.play();
          console.log('▶️ Primary video playback resumed');
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
        
        // Instant switch by swapping active/inactive
        const previousActive = currentActiveVideo;
        currentActiveVideo = currentActiveVideo === 'primary' ? 'secondary' : 'primary';
        
        // If video was playing, start the new active video immediately
        if (wasCurrentlyPlaying && playing) {
          await activeVideoElement.play();
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
        
        // Switch to the newly loaded video
        const previousActive = currentActiveVideo;
        currentActiveVideo = currentActiveVideo === 'primary' ? 'secondary' : 'primary';
        console.log(`🔄 Switched active video: ${previousActive} -> ${currentActiveVideo}`);
        
        // Resume playback if it was playing before
        if (wasCurrentlyPlaying && playing) {
          await activeVideoElement.play();
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
  
  $: if (activeVideoElement && playing !== undefined) {
    handlePlayStateChange(playing);
  }
  
  async function handlePlayStateChange(shouldPlay) {
    if (!activeVideoElement || !currentVideo) return;
    
    try {
      if (shouldPlay && !wasPlaying) {
        // Validate video is ready before playing
        if (activeVideoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          await activeVideoElement.play();
          wasPlaying = true;
          console.log('▶️ Video playback started');
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
          await activeVideoElement.play();
          wasPlaying = true;
          console.log('▶️ Video playback started (after waiting)');
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
  
  function handleEnded() {
    // When video ends, we'll loop it
    if (activeVideoElement && playing) {
      activeVideoElement.currentTime = 0;
      activeVideoElement.play().catch(err => console.error('Video loop error:', err));
    }
  }
  
  onMount(() => {
    if (primaryVideo && currentVideo) {
      console.log('🎬 Initial video load:', currentVideo.name, 'URL:', currentVideo.url);
      primaryVideo.src = currentVideo.url;
      currentVideoId = currentVideo.id;
      currentActiveVideo = 'primary';
      
      // Ensure the primary video is visible initially
      primaryVideo.addEventListener('loadeddata', () => {
        console.log('✅ Initial video loaded successfully');
      });
      
      primaryVideo.load();
    }
  });
  
  // Export method to get current video time
  export function getCurrentTime() {
    return activeVideoElement ? activeVideoElement.currentTime : null;
  }
</script>

<div class="video-player">
  {#if currentVideo}
    <!-- Primary video element -->
    <video
      bind:this={primaryVideo}
      class="video-element {currentActiveVideo === 'primary' ? 'active' : 'inactive'}"
      on:ended={handleEnded}
      aria-label="Primary video player for {currentVideo.name}"
      muted={currentActiveVideo !== 'primary'}
    >
      <track kind="captions" src="" label="No captions available" default />
    </video>
    
    <!-- Secondary video element -->
    <video
      bind:this={secondaryVideo}
      class="video-element {currentActiveVideo === 'secondary' ? 'active' : 'inactive'}"
      on:ended={handleEnded}
      aria-label="Secondary video player for {currentVideo.name}"
      muted={currentActiveVideo !== 'secondary'}
    >
      <track kind="captions" src="" label="No captions available" default />
    </video>
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
  
  .video-element {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    top: 0;
    left: 0;
    transition: opacity 0.1s ease-in-out;
  }
  
  .video-element.active {
    opacity: 1;
    z-index: 2;
  }
  
  .video-element.inactive {
    opacity: 0;
    z-index: 1;
  }
  
  .no-video {
    color: #666;
    font-size: 18px;
    z-index: 3;
  }
</style>
