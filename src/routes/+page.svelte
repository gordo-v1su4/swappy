<script>
  import { onMount } from 'svelte';
  import { Play, Volume2 } from 'lucide-svelte';

  let audioFile = null;
  let isProcessing = false;
  let progress = 0;
  let beatThreshold = 0.5;
  let loudnessThreshold = 0.3;
  let currentTime = '0:00';
  let duration = '0:00';
  let volume = 0.75;

  function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (file) {
      // Handle audio upload
      console.log('Audio file uploaded:', file.name);
    }
  }

  function handleVideoUpload(event) {
    const files = event.target.files;
    if (files.length > 0) {
      // Handle video upload
      console.log('Video files uploaded:', files.length);
    }
  }
</script>

<div class="max-w-5xl mx-auto space-y-6">
  <!-- Main Editor Card -->
  <div class="bg-background-lighter rounded-lg p-6">
    <!-- Header Buttons -->
    <div class="flex gap-4 mb-6">
      <label class="btn btn-disabled">
        <input type="file" accept="audio/*" class="hidden" on:change={handleAudioUpload} />
        Upload Audio
      </label>
      <button class="btn btn-outline" disabled={!audioFile}>Split Stems</button>
      <button class="btn btn-primary" disabled={!audioFile}>Analyze Beats</button>
    </div>

    <!-- Audio Analysis Controls -->
    <div class="space-y-6">
      <div>
        <label class="block text-primary mb-2">Beat Detection Threshold</label>
        <input
          type="range"
          class="slider"
          min="0"
          max="1"
          step="0.01"
          bind:value={beatThreshold}
        />
        <p class="text-sm text-secondary mt-1">
          Lower values catch only stronger beats. Higher values include subtle beats.
        </p>
      </div>

      <div>
        <label class="block text-primary mb-2">Loudness Threshold for Energy Jumps</label>
        <input
          type="range"
          class="slider"
          min="0"
          max="1"
          step="0.01"
          bind:value={loudnessThreshold}
        />
      </div>
    </div>

    <!-- Waveform Visualizer -->
    {#if !isProcessing}
      <div class="waveform-container mt-6">
        <div class="flex items-center justify-between p-4">
          <div class="flex items-center gap-4">
            <button class="text-primary hover:text-accent">
              <Play size={24} />
            </button>
            <span class="text-secondary">{currentTime} / {duration}</span>
          </div>
          <div class="flex items-center gap-2">
            <Volume2 size={20} class="text-secondary" />
            <input
              type="range"
              class="slider w-24"
              min="0"
              max="1"
              step="0.01"
              bind:value={volume}
            />
          </div>
        </div>
      </div>
    {:else}
      <!-- Processing State -->
      <div class="mt-6 p-6 bg-background-lighter rounded-lg">
        <div class="h-2 bg-disabled rounded-full overflow-hidden">
          <div
            class="h-full bg-accent transition-all duration-300"
            style="width: {progress}%"
          ></div>
        </div>
        <p class="text-center text-secondary mt-4">Processing audio and detecting beats...</p>
      </div>
    {/if}

    <!-- Video Preview -->
    <div class="video-preview"></div>

    <!-- Video Uploads -->
    <div class="mt-6">
      <label class="btn btn-disabled block w-full text-center">
        <input
          type="file"
          accept="video/*"
          multiple
          class="hidden"
          on:change={handleVideoUpload}
        />
        Upload Videos
      </label>
      <div class="thumbnail-grid">
        <!-- Video thumbnails will be added here -->
      </div>
    </div>
  </div>
</div>

<!-- Notification Component -->
{#if isProcessing}
  <div class="notification" transition:fade>
    Processing videos...
  </div>
{/if}
