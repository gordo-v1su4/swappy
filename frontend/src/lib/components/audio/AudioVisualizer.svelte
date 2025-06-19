<script lang="ts">
  // Props using the new runes syntax
  let props = $props<{
    volume: number;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    showFrequencyAnalysis: boolean;
  }>();

  // Container refs
  let waveformContainer: HTMLElement;
  let frequencyContainer: HTMLElement;

  // Format time helper
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="audio-visualizer">
  <!-- Waveform display -->
  <div 
    bind:this={waveformContainer}
    class="waveform-container"
  >
    <div class="placeholder-wave"></div>
  </div>

  <!-- Time display -->
  <div class="time-display">
    <span>{formatTime(props.currentTime)}</span>
    <span>{formatTime(props.duration)}</span>
  </div>

  <!-- Frequency analysis -->
  {#if props.showFrequencyAnalysis}
    <div 
      bind:this={frequencyContainer}
      class="frequency-container"
    >
      <div class="placeholder-bars"></div>
    </div>
  {/if}
</div>

<style>
  .audio-visualizer {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .waveform-container {
    flex: 1;
    background: var(--surface-color-alt);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .placeholder-wave {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--text-muted);
    opacity: 0.5;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-family: monospace;
    color: var(--text-muted);
  }

  .frequency-container {
    height: 60px;
    background: var(--surface-color-alt);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .placeholder-bars {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 100%;
    padding: 0.5rem;
  }

  .placeholder-bars::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      to right,
      var(--text-muted) 0,
      var(--text-muted) 4px,
      transparent 4px,
      transparent 8px
    );
    opacity: 0.2;
  }
</style> 