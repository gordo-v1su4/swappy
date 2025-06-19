<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import VideoPlayer from '$lib/components/video/VideoPlayer.svelte';
  import AudioVisualizer from '$lib/components/audio/AudioVisualizer.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { initializeFFmpeg } from '$lib/services/ffmpeg';

  // Basic state using runes
  let volume = $state(1);
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let showFrequencyAnalysis = $state(false);

  // Video state
  let videos = $state([]);
  let currentVideoIndex = $state(-1);

  // Derived state
  let currentVideo = $derived(() => currentVideoIndex >= 0 ? videos[currentVideoIndex] : null);

  // Transient detection settings
  let density = $state(91);
  let randomness = $state(41);
  let sensitivity = $state(70);
  let minSpacing = $state(0.05);
  let snapThreshold = $state(0.55);

  // Marker settings
  let enableSnapping = $state(true);
  let snapToTransients = $state(true);
  let snapToBeats = $state(false);

  // Use $effect for initialization
  $effect(() => {
    initializeFFmpeg().catch(console.error);
  });

  // Handle file uploads
  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    await Promise.all(files.map(processVideoFile));
  }

  function handleVolumeChange(event) {
    volume = parseFloat(event.target.value);
  }

  function toggleFrequencyAnalysis() {
    showFrequencyAnalysis = !showFrequencyAnalysis;
  }

  function handleVideoPositionSave(event) {
    const { id, position } = event.detail;
    savedPositions[id] = position;
  }

  function handleVideoError(event) {
    console.error('Video error:', event.detail);
  }

  // Video grid management
  function handleDragStart(event, index) {
    event.dataTransfer.setData('text/plain', index.toString());
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(event, targetIndex) {
    event.preventDefault();
    const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'));
    if (sourceIndex === targetIndex) return;

    const [movedVideo] = videos.splice(sourceIndex, 1);
    videos.splice(targetIndex, 0, movedVideo);
    videos = videos; // Trigger reactivity

    // Update currentVideoIndex if needed
    if (currentVideoIndex === sourceIndex) {
      currentVideoIndex = targetIndex;
    } else if (currentVideoIndex > sourceIndex && currentVideoIndex <= targetIndex) {
      currentVideoIndex--;
    } else if (currentVideoIndex < sourceIndex && currentVideoIndex >= targetIndex) {
      currentVideoIndex++;
    }
  }

  function toggleReorderingMode() {
    isReorderingMode = !isReorderingMode;
    if (!isReorderingMode) {
      showInsertionInterface = false;
    }
  }

  function handleInsertionClick(index) {
    insertionIndex = index;
    showInsertionInterface = true;
  }

  function handleInsertionFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;

    const newVideos = [];
    for (const file of files) {
      if (file.type.startsWith('video/')) {
        const video = {
          id: uuidv4(),
          name: file.name,
          url: URL.createObjectURL(file),
          file: file,
          thumbnailUrl: null,
          loaded: true,
          processing: false
        };
        newVideos.push(video);
      }
    }

    if (newVideos.length > 0) {
      videos = [
        ...videos.slice(0, insertionIndex),
        ...newVideos,
        ...videos.slice(insertionIndex)
      ];

      // Update currentVideoIndex if needed
      if (currentVideoIndex >= insertionIndex) {
        currentVideoIndex += newVideos.length;
      }
    }

    showInsertionInterface = false;
  }

  // Use $effect for cleanup
  onDestroy(() => {
    // Clean up object URLs
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    videos.forEach(video => {
      if (video.url) {
        URL.revokeObjectURL(video.url);
      }
    });
  });
</script>

<div class="flex h-screen bg-background">
  <!-- Left sidebar -->
  <div class="w-64 border-r border-border p-4 bg-card">
    <h2 class="text-lg font-semibold mb-4">Audio Files</h2>
    <button class="btn btn-primary w-full mb-4">
      OPEN AUDIO FILE
    </button>
    <div class="flex items-center justify-center h-32 border-2 border-dashed border-border rounded-lg">
      <div class="text-center text-muted-foreground">
        <div class="text-4xl mb-2">🎵</div>
        <p>No audio files uploaded yet</p>
        <p class="text-sm">Click "Open Audio File" to get started</p>
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 p-4">
    <div class="space-y-6">
      <!-- Playback controls -->
      <div class="flex items-center space-x-4">
        <button class="btn btn-circle" class:btn-primary={isPlaying}>
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <div class="text-sm font-mono">
          {currentTime.toFixed(2)} / {duration.toFixed(2)}
        </div>
      </div>

      <!-- Volume and zoom controls -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Volume</label>
          <input 
            type="range" 
            bind:value={volume} 
            min="0" 
            max="1" 
            step="0.01"
            class="range"
          />
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium">Zoom</label>
          <input 
            type="range" 
            min="1" 
            max="100" 
            class="range"
          />
        </div>
      </div>

      <!-- Waveform visualization -->
      <div class="h-48 bg-card rounded-lg border border-border">
        <!-- Waveform will be rendered here -->
      </div>

      <!-- Transient Detection -->
      <div class="space-y-4 bg-card p-4 rounded-lg border border-border">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Transient Detection</h3>
          <button class="btn btn-secondary">DETECT TRANSIENTS</button>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Density ({density}%)</label>
            <input 
              type="range" 
              bind:value={density} 
              min="0" 
              max="100"
              class="range"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Randomness ({randomness}%)</label>
            <input 
              type="range" 
              bind:value={randomness} 
              min="0" 
              max="100"
              class="range"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Sensitivity ({sensitivity}%)</label>
            <input 
              type="range" 
              bind:value={sensitivity} 
              min="0" 
              max="100"
              class="range"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Min Spacing ({minSpacing}s)</label>
            <input 
              type="range" 
              bind:value={minSpacing} 
              min="0.01" 
              max="1"
              step="0.01"
              class="range"
            />
          </div>
        </div>
      </div>

      <!-- Audio Analysis -->
      <div class="bg-card p-4 rounded-lg border border-border">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Audio Analysis</h3>
          <button class="btn btn-secondary">DETECT BPM & KEY</button>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-4">
          <!-- Analysis results will go here -->
        </div>
      </div>

      <!-- Marker Snapping -->
      <div class="bg-card p-4 rounded-lg border border-border">
        <h3 class="text-lg font-semibold mb-4">Marker Snapping</h3>
        <div class="space-y-4">
          <label class="flex items-center space-x-2">
            <input 
              type="checkbox" 
              bind:checked={enableSnapping}
              class="checkbox"
            />
            <span>Enable Snapping</span>
          </label>
          
          <div class="flex space-x-4">
            <label class="flex items-center space-x-2">
              <input 
                type="radio" 
                bind:group={snapToTransients}
                value={true}
                class="radio"
              />
              <span>Snap to Transients</span>
            </label>
            <label class="flex items-center space-x-2">
              <input 
                type="radio" 
                bind:group={snapToBeats}
                value={true}
                class="radio"
              />
              <span>Snap to Beats</span>
            </label>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium">Snap Threshold ({snapThreshold}s)</label>
            <input 
              type="range" 
              bind:value={snapThreshold} 
              min="0.01" 
              max="1"
              step="0.01"
              class="range"
            />
          </div>
        </div>
      </div>

      <!-- Timeline controls -->
      <div class="flex space-x-4">
        <button class="btn btn-outline">Add Timestamp</button>
        <button class="btn btn-outline">Loop Region</button>
      </div>
    </div>
  </div>
</div>

<style>
  :global(:root) {
    --background: #121212;
    --foreground: #ffffff;
    --card: #1e1e1e;
    --card-foreground: #ffffff;
    --border: #2a2a2a;
    --primary: #0ea5e9;
    --primary-foreground: #ffffff;
    --secondary: #2a2a2a;
    --secondary-foreground: #ffffff;
    --muted: #2a2a2a;
    --muted-foreground: #a1a1aa;
  }

  .btn {
    @apply px-4 py-2 rounded-md font-medium transition-colors;
  }

  .btn-primary {
    @apply bg-primary text-primary-foreground hover:bg-primary/90;
  }

  .btn-secondary {
    @apply bg-secondary text-secondary-foreground hover:bg-secondary/80;
  }

  .btn-outline {
    @apply border border-border hover:bg-secondary;
  }

  .btn-circle {
    @apply rounded-full w-10 h-10 flex items-center justify-center p-0;
  }

  .range {
    @apply w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer;
  }

  .range::-webkit-slider-thumb {
    @apply appearance-none w-4 h-4 rounded-full bg-primary;
  }

  .checkbox {
    @apply w-4 h-4 rounded border-border bg-background;
  }

  .radio {
    @apply w-4 h-4 rounded-full border-border bg-background;
  }
</style> 