<script>
  import AudioTimeline from "./AudioTimeline.svelte";
  import AudioFileManager from "./AudioFileManager.svelte";
  import VideoEditor from "./VideoEditor.svelte";

  // Svelte 5 runes for reactive state
  let selectedAudioUrl = $state(null);

  // Force clear any stale state on app load
  if (typeof window !== "undefined") {
    // Clear any potential stale blob URLs
    selectedAudioUrl = null;
    console.log("🧹 Cleared selectedAudioUrl on app initialization");
  }
  let projectName = $state("Untitled Project");
  let isPanelCollapsed = $state(false); // State for panel collapse
  let selectedFilter = $state("none"); // State for the selected filter

  // Debug logging for state changes
  $effect(() => {
    console.log("🔍 App state debug:", {
      selectedAudioUrl,
      selectedAudioUrlType: typeof selectedAudioUrl,
      selectedAudioUrlLength: selectedAudioUrl?.length,
      masterAudio: masterAudio?.name || "null",
      audioStems: audioStems.length,
      visibleStems: visibleStems.length,
    });
  });

  // Audio state for video synchronization
  let audioState = $state({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
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
    trigger: "transients",
    duration: 0.3,
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

    // Update project title to match the master audio file name
    const fileName = masterSong.name;
    const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
    projectName = nameWithoutExtension;

    console.log("Master song selected:", masterSong.name);
    console.log("Project title updated to:", projectName);
  }

  // Handle stems update from enhanced audio file manager
  function handleStemsUpdated(event) {
    const { stems, visibleStems: newVisibleStems } = event.detail;
    audioStems = stems;

    // Prevent infinite loops by only updating if the array content has changed
    if (JSON.stringify(visibleStems) !== JSON.stringify(newVisibleStems)) {
      visibleStems = newVisibleStems;
    }

    console.log(
      "Stems updated:",
      stems.length,
      "visible:",
      newVisibleStems.length,
    );
  }

  // Handle transients update from enhanced audio file manager
  function handleTransientsUpdated(event) {
    const data = event.detail;
    console.log("🎯 App.svelte: Transients updated:", data);
    // Forward to AudioTimeline
    if (audioTimelineComponent) {
      if (audioTimelineComponent.handleTransientsUpdated) {
        console.log("📤 Forwarding transients to AudioTimeline...");
        audioTimelineComponent.handleTransientsUpdated(data);
      } else {
        console.warn(
          "⚠️ AudioTimeline handleTransientsUpdated method not available",
        );
      }
    } else {
      console.warn("⚠️ AudioTimeline component not available");
    }
  }

  function handleAudioState(event) {
    audioState = event.detail;
  }

  function handleSpeedRamp(event) {
    console.log("🚀 App.svelte: Speed ramp event received:", event.detail);
    speedRampState = {
      ...speedRampState,
      enabled: true, // Ensure enabled is set when speed ramping occurs
      currentSpeed: event.detail.speed,
    };
    console.log("📊 Updated speedRampState:", speedRampState);
  }

  // Function to get markers from AudioTimeline
  function updateAudioMarkers() {
    if (audioTimelineComponent) {
      try {
        // Get transient markers from AudioTimeline
        const transientMarkers =
          audioTimelineComponent.getTransientMarkers?.() || [];
        const userMarkers = audioTimelineComponent.getUserMarkers?.() || [];

        // Combine all markers
        audioMarkers = [...transientMarkers, ...userMarkers];
        console.log(`🎯 Updated audio markers: ${audioMarkers.length} total`);

        // Also sync speed ramp state
        if (audioTimelineComponent.getSpeedRampState) {
          const currentSpeedState = audioTimelineComponent.getSpeedRampState();
          speedRampState = { ...speedRampState, ...currentSpeedState };
          console.log(
            "🔄 Synced speed ramp state:",
            $state.snapshot(speedRampState),
          );
        }
      } catch (error) {
        console.warn("⚠️ Could not get markers from AudioTimeline:", error);
        audioMarkers = [];
      }
    }
  }
</script>

<div class="app-container">
  <header class="app-header">
    <h1 class="app-title">
      SWAPPY <span style="font-weight: 300; opacity: 0.7;">STUDIO</span>
    </h1>
    <div class="project-info">
      <span class="project-label">Project</span>
      <span class="project-title">{projectName}</span>
    </div>
  </header>

  <main class="main-layout">
    <aside class="sidebar">
      <AudioFileManager
        on:masterSelected={handleMasterSelected}
        on:stemsUpdated={handleStemsUpdated}
        on:transientsUpdated={handleTransientsUpdated}
      />
    </aside>

    <section class="content-area">
      <AudioTimeline
        bind:this={audioTimelineComponent}
        audioUrl={selectedAudioUrl}
        bind:projectName
        {masterAudio}
        {audioStems}
        {visibleStems}
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
          {audioMarkers}
          {speedRampState}
        />
      {/if}
    </section>
  </main>
</div>

<style>
  /* Global Variables & Reset */
  :global(:root) {
    --primary-color: #00f2ea;
    --primary-glow: rgba(0, 242, 234, 0.4);
    --accent-color: #ff0055;
    --bg-dark: #0a0a0a;
    --bg-panel: rgba(255, 255, 255, 0.03);
    --glass-border: rgba(255, 255, 255, 0.08);
    --text-main: #ffffff;
    --text-muted: #888888;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: var(--bg-dark);
    color: var(--text-main);
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    line-height: 1.5;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(button) {
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }

  .app-container {
    width: 100%;
    max-width: 1600px; /* Increased max-width for better layout */
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 30px;
    padding: 20px;
    background: var(--bg-panel);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    backdrop-filter: blur(10px);
  }

  .app-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--primary-color), #fff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.5px;
  }

  .project-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .project-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .project-title {
    font-size: 1rem;
    color: var(--text-main);
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    border: 1px solid transparent;
    transition: all 0.2s;
  }

  .project-title:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--glass-border);
  }

  .main-layout {
    display: grid;
    grid-template-columns: 320px 1fr; /* Fixed sidebar width */
    gap: 24px;
    flex: 1;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .content-area {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0; /* Prevent overflow */
  }

  @media (max-width: 1024px) {
    .main-layout {
      grid-template-columns: 1fr;
    }

    .sidebar {
      order: 2; /* Move sidebar below content on mobile */
    }
  }
</style>
