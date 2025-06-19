<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  export let currentVideo = null;
  export let playing = false;
  export let savedPositions = {};
  
  let videoElement;
  let lastSavedPosition = -1;
  let wasPlaying = false;
  const dispatch = createEventDispatcher();
  
  $: if (videoElement && currentVideo) {
    handleVideoChange(currentVideo);
  }
  
  async function handleVideoChange(video) {
    if (!videoElement || !video) return;
    
    try {
      if (videoElement.src !== video.url) {
        console.log('🔄 Swapping video to', video.url);
        
        // Pause current video to prevent race conditions
        const wasCurrentlyPlaying = !videoElement.paused;
        if (wasCurrentlyPlaying) {
          videoElement.pause();
        }
        
        // Set new source and wait for it to load
        videoElement.src = video.url;
        console.log('📝 Set src to', video.url);
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          const handleLoadedData = () => {
            videoElement.removeEventListener('loadeddata', handleLoadedData);
            videoElement.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = (error) => {
            videoElement.removeEventListener('loadeddata', handleLoadedData);
            videoElement.removeEventListener('error', handleError);
            reject(new Error(`Failed to load video: ${error.message || 'Unknown error'}`));
          };
          
          videoElement.addEventListener('loadeddata', handleLoadedData);
          videoElement.addEventListener('error', handleError);
          videoElement.load();
        });
        
        console.log('✅ Video loaded successfully');
        
        // Restore saved position after video is loaded
        if (savedPositions[video.id] !== undefined) {
          videoElement.currentTime = savedPositions[video.id];
          console.log(`⏰ Restored position: ${savedPositions[video.id].toFixed(2)}s`);
        } else {
          videoElement.currentTime = 0;
        }
        
        // Resume playback if it was playing before
        if (wasCurrentlyPlaying && playing) {
          await videoElement.play();
        }
      }
    } catch (error) {
      console.error('❌ Error during video change:', error);
      // Dispatch error event for parent to handle
      dispatch('videoerror', { error: error.message, video });
    }
  }
  
  $: if (videoElement && playing !== undefined) {
    handlePlayStateChange(playing);
  }
  
  async function handlePlayStateChange(shouldPlay) {
    if (!videoElement || !currentVideo) return;
    
    try {
      if (shouldPlay && !wasPlaying) {
        // Validate video is ready before playing
        if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          await videoElement.play();
          wasPlaying = true;
          console.log('▶️ Video playback started');
        } else {
          console.warn('⚠️ Video not ready for playback, waiting...');
          // Wait for video to be ready
          await new Promise((resolve) => {
            const handleCanPlay = () => {
              videoElement.removeEventListener('canplay', handleCanPlay);
              resolve();
            };
            videoElement.addEventListener('canplay', handleCanPlay);
          });
          await videoElement.play();
          wasPlaying = true;
          console.log('▶️ Video playback started (after waiting)');
        }
      } else if (!shouldPlay && wasPlaying) {
        // Pause and save position
        videoElement.pause();
        wasPlaying = false;
        console.log('⏸️ Video playback paused');
        
        // Save current position when pausing (only if position changed significantly)
        if (currentVideo && Math.abs(videoElement.currentTime - lastSavedPosition) > 0.1) {
          lastSavedPosition = videoElement.currentTime;
          dispatch('saveposition', {
            id: currentVideo.id,
            position: videoElement.currentTime
          });
          console.log(`💾 Position saved: ${videoElement.currentTime.toFixed(2)}s`);
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
    if (videoElement && playing) {
      videoElement.currentTime = 0;
      videoElement.play().catch(err => console.error('Video loop error:', err));
    }
  }
  
  onMount(() => {
    if (videoElement && currentVideo) {
      videoElement.src = currentVideo.url;
    }
  });
  
  // Export method to get current video time
  export function getCurrentTime() {
    return videoElement ? videoElement.currentTime : null;
  }
</script>

<div class="video-player">
  {#if currentVideo}
    <video
      bind:this={videoElement}
      src={currentVideo.url}
      on:ended={handleEnded}
      aria-label="Video player for {currentVideo.name}"
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
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  .no-video {
    color: #666;
    font-size: 18px;
  }
</style>
