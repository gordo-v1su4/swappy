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
    if (videoElement.src !== currentVideo.url) {
      console.log(' Swapping video to', currentVideo.url);
      videoElement.src = currentVideo.url;
      console.log(' Set src to', currentVideo.url);
      videoElement.load();
      console.log(' Called load() on video element');
    }
    // If we have a saved position for this video, restore it
    if (savedPositions[currentVideo.id] !== undefined) {
      videoElement.currentTime = savedPositions[currentVideo.id];
    } else {
      videoElement.currentTime = 0;
    }
  }
  
  $: if (videoElement && playing !== undefined) {
    if (playing && !wasPlaying) {
      // Only play if we weren't already playing
      videoElement.play().catch(err => console.error('Video play error:', err));
      wasPlaying = true;
    } else if (!playing && wasPlaying) {
      // Only pause and save position if we were actually playing
      videoElement.pause();
      wasPlaying = false;
      
      // Save current position when pausing (only if position changed)
      if (currentVideo && videoElement.currentTime !== lastSavedPosition) {
        lastSavedPosition = videoElement.currentTime;
        dispatch('saveposition', { 
          id: currentVideo.id, 
          position: videoElement.currentTime 
        });
      }
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
