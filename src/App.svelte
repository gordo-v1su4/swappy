<script>
import AudioTimeline from './AudioTimeline.svelte';
import AudioFileManager from './AudioFileManager.svelte';
import VideoEditor from './VideoEditor.svelte';

// Svelte 5 runes for reactive state
let selectedAudioUrl = $state(null);
let projectName = $state('Untitled Project');
let isPanelCollapsed = $state(false); // State for panel collapse
let selectedFilter = $state('none'); // State for the selected filter

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

function handleFileSelect(event) {
  selectedAudioUrl = event.detail.url;
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
        console.log('🔄 Synced speed ramp state:', speedRampState);
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

function togglePanel() {
  isPanelCollapsed = !isPanelCollapsed;
}
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
  

  
  .app-layout { /* Changed from two-column to app-layout */
    display: grid;
    grid-template-columns: 300px 1fr auto; /* Added auto for the new panel */
    gap: 20px;
    width: 100%;
    max-width: 100%;
  }
  
  .main-content {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  .filter-panel {
    width: 250px; /* Initial width for the panel */
    background-color: #1e1e1e;
    padding: 15px;
    border-left: 1px solid #333;
    transition: width 0.3s ease;
    overflow: hidden;
  }

  .filter-panel.collapsed {
    width: 40px; /* Width when collapsed */
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .panel-title {
    font-size: 16px;
    font-weight: 500;
    color: #00b8a9;
  }

  .toggle-button {
    background: none;
    border: none;
    color: #a1a1aa;
    font-size: 20px;
    cursor: pointer;
  }
  
  @media (max-width: 992px) { /* Adjusted breakpoint for three columns */
    .app-layout {
      grid-template-columns: 1fr; /* Stack main content and panels */
    }
    .filter-panel {
      width: 100%; /* Full width on smaller screens */
      border-left: none;
      border-top: 1px solid #333;
    }
    .filter-panel.collapsed {
      height: 40px; /* Height when collapsed on smaller screens */
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    /* Keep stacking for even smaller screens, no specific changes from 992px needed here for layout */
    /* Sidebar might also stack if not already handled */
     .app-layout {
      grid-template-columns: 1fr; /* Ensure stacking */
    }
    .sidebar {
      margin-bottom: 20px; /* Add some space if sidebar stacks above main content */
    }
  }

  .filter-group {
    margin-bottom: 15px;
  }

  .filter-group label {
    display: block;
    margin-bottom: 5px;
    color: #a1a1aa;
    font-size: 14px;
  }

  .filter-select-dropdown {
    width: 100%;
    padding: 8px;
    background-color: #333;
    color: #e6e6e6;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 14px;
  }
</style>

<div class="container">
  <div class="app-header">
    <h1 class="app-title">Audio Editor</h1>
    <div class="project-info">
      <span class="project-title">{projectName}</span>
    </div>
  </div>
  
  <div class="app-layout"> <!-- Was two-column, now app-layout -->
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
          currentFilter={selectedFilter} /* Pass the selected filter */
        />
      {/if}
    </div>

    <div class="filter-panel" class:collapsed={isPanelCollapsed}>
      <div class="panel-header">
        {#if !isPanelCollapsed}
          <h3 class="panel-title">Filter Controls</h3>
        {/if}
        <button class="toggle-button" on:click={togglePanel} aria-label={isPanelCollapsed ? 'Expand panel' : 'Collapse panel'}>
          {isPanelCollapsed ? '‹' : '›'}
        </button>
      </div>
      {#if !isPanelCollapsed}
        <div class="panel-content">
          <div class="filter-group">
            <label for="filter-select">Video Filter</label>
            <select id="filter-select" bind:value={selectedFilter} class="filter-select-dropdown">
              <option value="none">None</option>
              <option value="invert">Invert Colors</option>
              <option value="grayscale">Grayscale</option>
              <!-- More filters can be added here -->
            </select>
          </div>
          <!-- More filter controls can be added below -->
        </div>
      {/if}
    </div>
  </div>
</div>


