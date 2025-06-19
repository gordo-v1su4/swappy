<!-- src/lib/components/video/VideoPlayer.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';

  export let videos = [];
  export let currentVideoIndex = 0;
  export let isPlaying = false;
  export let currentTime = 0;

  const dispatch = createEventDispatcher();
  let videoElement;
  let savedPositions = {};

  $: if (videoElement && videos[currentVideoIndex]) {
    videoElement.load();
    videoElement.play().catch(e => console.error("Autoplay was prevented", e));
  }

  $: if (videoElement && isPlaying !== undefined) {
    handlePlayStateChange(isPlaying);
  }

  $: if (videoElement && currentTime !== undefined) {
    handleTimeUpdate(currentTime);
  }

  async function handlePlayStateChange(shouldPlay) {
    if (!videoElement) return;

    try {
      if (shouldPlay) {
        await videoElement.play();
      } else {
        savedPositions[currentVideoIndex] = videoElement.currentTime;
        videoElement.pause();
      }
    } catch (error) {
      console.error('Error during play state change:', error);
      dispatch('error', { message: error.message });
    }
  }

  function handleTimeUpdate(time) {
    if (!videoElement || Math.abs(videoElement.currentTime - time) < 0.1) return;
    
    try {
      videoElement.currentTime = time;
    } catch (error) {
      console.error('Error during time update:', error);
    }
  }

  function handleVideoTimeUpdate() {
    dispatch('timeupdate', videoElement.currentTime);
  }

  function handleVideoEnded() {
    if (currentVideoIndex < videos.length - 1) {
      currentVideoIndex++;
    } else {
      currentVideoIndex = 0;
    }
  }

  onMount(() => {
    if (videos[0] && videoElement) {
      videoElement.load();
      videoElement.play().catch(e => console.error("Autoplay was prevented", e));
    }

    return () => {
      if (videoElement?.src) URL.revokeObjectURL(videoElement.src);
    };
  });
</script>

<div class="relative aspect-video bg-black rounded-md overflow-hidden">
  <video
    bind:this={videoElement}
    class="w-full h-full object-contain"
    controls
    on:ended={() => {
      if (currentVideoIndex < videos.length - 1) {
        currentVideoIndex++;
      } else {
        currentVideoIndex = 0; // Loop
      }
    }}
  >
    {#if videos[currentVideoIndex]}
      <source src={videos[currentVideoIndex]} type="video/mp4" />
    {/if}
  </video>

  {#if !videos.length}
    <div class="absolute inset-0 flex items-center justify-center text-white/50 pointer-events-none">
      <p>Upload videos to start</p>
    </div>
  {/if}

  <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white opacity-0 transition-opacity duration-200 hover:opacity-100 z-30">
    <div class="flex justify-between items-center">
      <span class="font-medium">Video {currentVideoIndex + 1} of {videos.length}</span>
      <span class="text-sm opacity-80 truncate">{videos[currentVideoIndex]?.name}</span>
    </div>
  </div>
</div> 