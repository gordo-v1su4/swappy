<!-- src/lib/components/audio/AudioVisualizer.svelte -->
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import WaveSurfer from 'wavesurfer.js';

  export let beatPositions = [];
  export let audioFile = null;
  
  const dispatch = createEventDispatcher();

  let waveformContainer;
  let wavesurfer;

  onMount(() => {
    return () => {
      if (wavesurfer) {
        wavesurfer.destroy();
      }
    };
  });

  $: if (audioFile && waveformContainer) {
    if (wavesurfer) {
      wavesurfer.destroy();
    }
    
    wavesurfer = WaveSurfer.create({
      container: waveformContainer,
      waveColor: '#2DD4BF',
      progressColor: '#14B8A6',
      cursorColor: '#ffffff',
      cursorWidth: 2,
      height: 128,
      normalize: true,
      backend: 'WebAudio'
    });

    wavesurfer.loadBlob(audioFile);
    
    wavesurfer.on('ready', (duration) => {
      dispatch('ready', { duration });
    });

    wavesurfer.on('audioprocess', (currentTime) => {
      dispatch('audioprocess', { currentTime });
    });
    
    wavesurfer.on('play', () => dispatch('play'));
    wavesurfer.on('pause', () => dispatch('pause'));
    wavesurfer.on('finish', () => dispatch('finish'));

    dispatch('wavesurfer', wavesurfer);
  }
</script>

<div class="waveform-container" bind:this={waveformContainer}>
  <!-- Beat Markers -->
  {#if beatPositions.length > 0 && wavesurfer}
    {@const duration = wavesurfer.getDuration()}
    {#if duration > 0}
      {#each beatPositions as position}
        <div
          class="beat-marker"
          style="left: {(position / duration) * 100}%"
        ></div>
      {/each}
    {/if}
  {/if}

  <!-- Time Markers -->
  {#if wavesurfer}
    {@const duration = wavesurfer.getDuration()}
    {#if duration > 0}
      {#each Array(6) as _, i}
        {@const time = (i * duration) / 5}
        <div
          class="time-marker"
          style="left: {(time / duration) * 100}%"
        >
          {Math.floor(time / 60)}:{Math.floor(time % 60).toString().padStart(2, '0')}
        </div>
      {/each}
    {/if}
  {/if}
</div>

<style>
  .waveform-container {
    @apply relative w-full h-32 bg-[#1F2937] rounded-md overflow-hidden;
  }

  .beat-marker {
    @apply absolute top-0 h-full w-px bg-white/10 pointer-events-none;
  }

  .time-marker {
    @apply absolute bottom-0 text-xs text-[#9CA3AF] transform -translate-x-1/2 pb-1;
  }
</style> 