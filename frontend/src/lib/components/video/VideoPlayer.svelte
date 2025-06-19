<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // Props using the new runes syntax
  let props = $props<{
    video: { url: string; name: string } | null;
    isPlaying: boolean;
  }>();

  // Create event dispatcher
  const dispatch = createEventDispatcher<{
    videoerror: { error: Error };
    timeupdate: { currentTime: number };
    durationchange: { duration: number };
  }>();

  // State
  let videoElement: HTMLVideoElement;
  let hls: Hls | null = null;
  let currentVideoId = '';

  $: if (props.video) {
    if (props.video.id !== currentVideoId) {
      currentVideoId = props.video.id;
      loadVideo(props.video.url);
    }
  }

  // Watch for playing state changes
  $effect(() => {
    if (!videoElement) return;
    
    if (props.isPlaying) {
      videoElement.play().catch(error => {
        console.error('Error playing video:', error);
        dispatch('videoerror', { error });
      });
    } else {
      videoElement.pause();
    }
  });

  onMount(() => {
    if (!videoElement) return;

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleEnded);
  });

  onDestroy(() => {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (videoElement) {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleEnded);
    }
  });

  // Handle video events
  function handleTimeUpdate() {
    if (!videoElement) return;
    dispatch('timeupdate', { currentTime: videoElement.currentTime });
  }

  function handleEnded() {
    dispatch('ended');
    props.isPlaying = false;
  }

  async function loadVideo(url: string) {
    if (!videoElement) return;

    // Clean up previous HLS instance
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // Reset video element
    videoElement.src = '';
    videoElement.load();

    if (Hls.isSupported() && url.includes('.m3u8')) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(url);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              initPlayer(url);
              break;
          }
        }
      });
    } else {
      videoElement.src = url;
    }

    // Restore saved position
    if (savedPositions[currentVideoId]) {
      videoElement.currentTime = savedPositions[currentVideoId];
    }

    if (props.isPlaying) {
      try {
        await videoElement.play();
      } catch (error) {
        console.error('Error playing video:', error);
        dispatch('videoerror', { error });
      }
    }
  }

  function initPlayer(url: string) {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    hls = new Hls();
    hls.attachMedia(videoElement);
    hls.loadSource(url);
  }

  function handleDurationChange() {
    if (!videoElement) return;
    dispatch('durationchange', { duration: videoElement.duration });
  }
</script>

<div class="video-player">
  {#if props.video}
    <video
      bind:this={videoElement}
      src={props.video.url}
      class="video-element"
      on:timeupdate={handleTimeUpdate}
      on:durationchange={handleDurationChange}
      aria-label="Video player for {props.video.name}"
    >
      <track kind="captions" src="" label="No captions available" default />
    </video>
  {:else}
    <div class="no-video">
      No video selected
    </div>
  {/if}
</div>

<style>
  .video-player {
    width: 100%;
    height: 100%;
    background: var(--surface-color);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  .video-element {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .no-video {
    color: var(--text-muted);
    font-size: 1.2rem;
  }
</style> 