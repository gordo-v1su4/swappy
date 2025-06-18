<script>
  import { onMount, createEventDispatcher } from 'svelte';


  export let markers = [];
  export let currentTime = 0;
  export let duration = 0;
  export let playing = false;

  const dispatch = createEventDispatcher();
  let container;
  let markerElements = [];

  // Update marker positions when markers or duration changes
  $: if (container && markers && duration) {
    updateMarkerPositions();
  }

  // Check for marker hits when currentTime changes
  $: if (playing && markers.length > 0) {
    checkMarkerHit(currentTime);
  }
  
  function updateMarkerPositions() {
    markerElements = markers.map(time => {
      const position = (time / duration) * 100;
      return {
        time,
        position
      };
    });
  }
  
  function checkMarkerHit(time) {
    // Check if we're close to any marker
    const hitTolerance = 0.05; // 50ms tolerance

    const hitMarker = markers.findIndex(markerTime =>
      Math.abs(markerTime - time) < hitTolerance
    );

    if (hitMarker !== -1) {
      dispatch('markerhit', { index: hitMarker, time: markers[hitMarker] });
    }
  }
  
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
</script>

<div class="markers" bind:this={container}>
  <div class="timeline">
    {#each markerElements as marker}
      <div
        class="marker"
        style="left: {marker.position}%;"
        title="Marker at {formatTime(marker.time)}"
      ></div>
    {/each}
    
    <!-- Current time indicator -->
    <div 
      class="playhead" 
      style="left: {(currentTime / duration) * 100}%;"
    ></div>
  </div>
</div>

<style>
  .markers {
    width: 100%;
    height: 40px;
    background-color: #1a1a1a;
    border-radius: 4px;
    position: relative;
    margin-top: 10px;
  }
  
  .timeline {
    width: 100%;
    height: 100%;
    position: relative;
  }
  
  .marker {
    position: absolute;
    width: 2px;
    height: 20px;
    background-color: #00b8a9;
    top: 10px;
    transform: translateX(-50%);
  }
  
  .playhead {
    position: absolute;
    width: 2px;
    height: 40px;
    background-color: #ff5a5f;
    top: 0;
    transform: translateX(-50%);
  }
</style>
