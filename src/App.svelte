<script>
import AudioTimeline from './AudioTimeline.svelte';
import AudioFileManager from './AudioFileManager.svelte';
import VideoEditor from './VideoEditor.svelte';

// Svelte 5 runes for reactive state
let selectedAudioUrl = $state(null);

// Force clear any stale state on app load
if (typeof window !== 'undefined') {
  // Clear any potential stale blob URLs
  selectedAudioUrl = null;
  console.log('🧹 Cleared selectedAudioUrl on app initialization');
}
let projectName = $state('Untitled Project');
let isPanelCollapsed = $state(false); // State for panel collapse
let selectedFilter = $state('none'); // State for the selected filter

// Debug logging for state changes
$effect(() => {
  console.log('🔍 App state debug:', {
    selectedAudioUrl,
    selectedAudioUrlType: typeof selectedAudioUrl,
    selectedAudioUrlLength: selectedAudioUrl?.length,
    masterAudio: masterAudio?.name || 'null',
    audioStems: audioStems.length,
    visibleStems: visibleStems.length
  });

  // Ensure state consistency: if we have selectedAudioUrl but no masterAudio, clear it
  if (selectedAudioUrl && !masterAudio) {
    console.warn('⚠️ State inconsistency detected: selectedAudioUrl exists but no masterAudio. Clearing selectedAudioUrl.');
    selectedAudioUrl = null;
    return;
  }
});

// Audio state for video synchronization
let audioState = $state({
  isPlaying: false,
  currentTime: 0,
  duration: 0
});

// Audio markers from AudioTimeline
let audioMarkers = $state([]);
let audioTimelineComponent = $state();

// Speed ramping state
let speedRampState = $state({
  enabled: false,
  currentSpeed: 1.0,
  amount: 1.5,
  randomness: 20,
  trigger: 'transients',
  duration: 0.3
});

// Enhanced audio management state
let masterAudio = $state(null);
let audioStems = $state([]);
let visibleStems = $state([]);

// Handle master song selection from enhanced audio file manager
function handleMasterSelected(event) {
  const masterSong = event.detail;
  masterAudio = masterSong;
  selectedAudioUrl = masterSong.url;
  console.log('Master song selected:', masterSong.name);
}

// Handle stems update from enhanced audio file manager
function handleStemsUpdated(event) {
  const { stems, visibleStems: visible } = event.detail;
  audioStems = stems;

  // Prevent infinite loops by only updating if the array content has changed
  if (JSON.stringify(visibleStems) !== JSON.stringify(visible)) {
    visibleStems = visible;
  }
  
  console.log('Stems updated:', stems.length, 'visible:', visible.length);

  // Debug: Check if stems have transients
  stems.forEach(stem => {
    console.log(`🎵 Stem ${stem.type}: ${stem.transients?.length || 0} transients, included: ${stem.included}, visible: ${stem.visible}`);
  });

  // You could implement stem mixing logic here
  // For now, we'll continue using the master track
}

// Handle transients update from enhanced audio file manager
function handleTransientsUpdated(event) {
  const data = event.detail;
  console.log('🎯 App.svelte: Transients updated:', data);
  // Forward to AudioTimeline
  if (audioTimelineComponent) {
    if (audioTimelineComponent.handleTransientsUpdated) {
      console.log('📤 Forwarding transients to AudioTimeline...');
      audioTimelineComponent.handleTransientsUpdated(data);
    } else {
      console.warn('⚠️ AudioTimeline handleTransientsUpdated method not available');
    }
  } else {
    console.warn('⚠️ AudioTimeline component not available');
  }
}

function handleAudioState(event) {
  audioState = event.detail;
}

function handleSpeedRamp(event) {
  console.log('🚀 App.svelte: Speed ramp event received:', event.detail);
  speedRampState = {
    ...speedRampState,
    enabled: true, // Ensure enabled is set when speed ramping occurs
    currentSpeed: event.detail.speed
  };
  console.log('📊 Updated speedRampState:', speedRampState);
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
      
      // Also sync speed ramp state
      if (audioTimelineComponent.getSpeedRampState) {
        const currentSpeedState = audioTimelineComponent.getSpeedRampState();
        speedRampState = { ...speedRampState, ...currentSpeedState };
        console.log('🔄 Synced speed ramp state:', $state.snapshot(speedRampState));
      }
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
      <AudioFileManager
        on:masterSelected={handleMasterSelected}
        on:stemsUpdated={handleStemsUpdated}
        on:transientsUpdated={handleTransientsUpdated}
      />
    </div>
    
    <div class="main-content">
      <AudioTimeline
        bind:this={audioTimelineComponent}
        audioUrl={selectedAudioUrl}
        bind:projectName={projectName}
        masterAudio={masterAudio}
        audioStems={audioStems}
        visibleStems={visibleStems}
        on:audiostate={handleAudioState}
        on:markersupdate={updateAudioMarkers}
        on:speedramp={handleSpeedRamp}
      />

      <!-- Video Editor Section -->
      {#if selectedAudioUrl}
        <VideoEditor
          audioUrl={selectedAudioUrl}
          isPlaying={audioState.isPlaying}
          currentTime={audioState.currentTime}
          duration={audioState.duration}
          audioMarkers={audioMarkers}
          speedRampState={speedRampState}
        />
      {/if}
    </div>
  </div>
</div>


