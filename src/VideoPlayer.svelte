<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  export let currentVideo = null;
  export let playing = false;
  export let savedPositions = {};
  
  let videoElement;
  const dispatch = createEventDispatcher();
  
  $: if (videoElement && currentVideo) {
    // If we have a saved position for this video, restore it
    if (savedPositions[currentVideo.id] !== undefined) {
      videoElement.currentTime = savedPositions[currentVideo.id];
    } else {
      videoElement.currentTime = 0;
    }
  }
  
  $: if (videoElement && playing !== undefined) {
    if (playing) {
      videoElement.play().catch(err => console.error('Video play error:', err));
    } else {
      videoElement.pause();
      // Save current position when pausing
      if (currentVideo) {
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
    height: 360px;
    background-color: #121212;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 15px;
    border: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .no-video {
    color: #666;
    font-size: 18px;
  }
</style>

