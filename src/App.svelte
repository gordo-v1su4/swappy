<script>
import AudioTimeline from './AudioTimeline.svelte';
import AudioFileManager from './AudioFileManager.svelte';
import VideoEditor from './VideoEditor.svelte';

// Svelte 5 runes for reactive state
let selectedAudioUrl = $state(null);
let projectName = $state('Untitled Project');

// Audio state for video synchronization
let audioState = $state({
  isPlaying: false,
  currentTime: 0,
  duration: 0
});

// Audio markers from AudioTimeline
let audioMarkers = $state([]);
let audioTimelineComponent = $state();

function handleFileSelect(event) {
  selectedAudioUrl = event.detail.url;
}

function handleAudioState(event) {
  audioState = event.detail;
}

// Function to get markers from AudioTimeline
function updateAudioMarkers() {
  if (audioTimelineComponent) {
    try {
      // Get transient markers from AudioTimeline
      const transientMarkers = audioTimelineComponent.getTransientMarkers?.() || [];
      const userMarkers = audioTimelineComponent.getUserMarkers?.() || [];
      
      // Combine all markers
      audioMarkers = [...transientMarkers, ...userMarkers];
      console.log(`🎯 Updated audio markers: ${audioMarkers.length} total`);
    } catch (error) {
      console.warn('⚠️ Could not get markers from AudioTimeline:', error);
      audioMarkers = [];
    }
  }
}

// Svelte 5 effect to update markers when dependencies change (throttled to prevent loops)
let lastUpdateTime = 0; // NOT reactive - regular variable
$effect(() => {
  if (selectedAudioUrl && audioTimelineComponent) {
    const now = Date.now();
    if (now - lastUpdateTime > 100) { // Throttle updates to prevent infinite loops
      lastUpdateTime = now;
      updateAudioMarkers();
    }
  }
});
</script>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #121212; /* pure dark background */
    color: #e6e6e6; /* light text */
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5;
    overflow-x: hidden; /* Prevent horizontal scrolling */
    box-sizing: border-box;
  }
  
  :global(*) {
    box-sizing: border-box;
  }

  :global(button) {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    overflow-x: hidden;
  }
  
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #333;
  }
  
  .app-title {
    color: #00b8a9;
    font-size: 24px;
    font-weight: 600;
    margin: 0;
  }
  
  .project-title {
    font-size: 18px;
    color: #e6e6e6;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .project-title:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  

  
  .two-column {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
    width: 100%;
    max-width: 100%;
  }
  
  .main-content {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  
  @media (max-width: 768px) {
    .two-column {
      grid-template-columns: 1fr;
    }
  }
</style>

<div class="container">
  <div class="app-header">
    <h1 class="app-title">Audio Editor</h1>
    <div class="project-info">
      <span class="project-title">{projectName}</span>
    </div>
  </div>
  
  <div class="two-column">
    <div class="sidebar">
      <AudioFileManager on:select={handleFileSelect} />
    </div>
    
    <div class="main-content">
      <AudioTimeline
        bind:this={audioTimelineComponent}
        audioUrl={selectedAudioUrl}
        bind:projectName={projectName}
        on:audiostate={handleAudioState}
        on:markersupdate={updateAudioMarkers}
      />

      <!-- Video Editor Section -->
      {#if selectedAudioUrl}
        <VideoEditor
          audioUrl={selectedAudioUrl}
          isPlaying={audioState.isPlaying}
          currentTime={audioState.currentTime}
          duration={audioState.duration}
          audioMarkers={audioMarkers}
        />
      {/if}
    </div>
  </div>
</div>


