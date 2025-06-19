<!-- src/routes/editor/+page.svelte -->
<script>
  import AudioVisualizer from '$lib/components/audio/AudioVisualizer.svelte';
  import VideoEffects from '$lib/components/video/VideoEffects.svelte';
  import VideoPlayer from '$lib/components/video/VideoPlayer.svelte';
  import { audioService } from '$lib/services/audio';
  import { onDestroy } from 'svelte';

  // UI State
  let isPlaying = false;
  let isProcessing = false;
  let processingStatus = '';

  // Audio State
  let audioFile = null;
  let wavesurfer;
  let currentTime = 0;
  let duration = 0;
  let beatPositions = [];
  let volume = 1;
  let beatDetectionThreshold = 0.75;
  let energyJumpThreshold = 0.5;

  // Video State
  let videos = [];
  let currentVideoIndex = 0;

  async function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    isProcessing = true;
    processingStatus = 'Loading audio waveform...';
    try {
      // These two lines are the core logic:
      // 1. Load the audio data into the service.
      // 2. Pass the raw file to the visualizer component.
      await audioService.loadAudio(file);
      audioFile = file;
    } catch (error) {
      processingStatus = 'Error loading audio.';
      console.error('Error loading audio:', error);
      setTimeout(() => isProcessing = false, 2000);
    }
  }
  
  function handleWaveformReady(event) {
    duration = event.detail.duration;
    isProcessing = false;
    processingStatus = '';
  }

  async function handleAnalyzeBeat() {
    if (isProcessing || !duration) return;
    
    isProcessing = true;
    processingStatus = 'Analyzing beats...';
    try {
      beatPositions = await audioService.detectBeats(
        beatDetectionThreshold,
        energyJumpThreshold
      );
      processingStatus = 'Beat analysis complete.';
    } catch (error) {
      console.error('Error detecting beats:', error);
      processingStatus = 'Error analyzing beats.';
    } finally {
      isProcessing = false;
      setTimeout(() => processingStatus = '', 2000);
    }
  }

  async function handleSplitStems() {
    if (isProcessing || !duration) return;

    isProcessing = true;
    processingStatus = 'Splitting stems... (this may take a while)';
    try {
      const stems = await audioService.splitStems();
      console.log('Stems created:', stems);
      processingStatus = 'Stem separation complete.';
    } catch (error) {
      console.error('Error splitting stems:', error);
      processingStatus = 'Error splitting stems.';
    } finally {
      isProcessing = false;
      setTimeout(() => processingStatus = '', 2000);
    }
  }

  function handleVideoUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const newVideos = Array.from(files).map(file => URL.createObjectURL(file));
    videos = [...videos, ...newVideos];
    
    if (videos.length > 0 && currentVideoIndex === -1) {
        currentVideoIndex = 0;
    }
  }

  function togglePlayPause() {
    if (!wavesurfer) return;
    wavesurfer.playPause();
  }

  function handleVolumeChange() {
    if (!wavesurfer) return;
    wavesurfer.setVolume(volume);
  }

  onDestroy(() => {
    audioService.destroy();
    videos.forEach(url => URL.revokeObjectURL(url));
  });
</script>

<div class="flex h-screen">
  <!-- Main Content -->
  <main class="flex-1 p-6 space-y-4 overflow-y-auto">
    <!-- Top Controls -->
    <div class="flex items-center gap-4">
      <input type="file" accept="audio/*" class="hidden" id="audio-upload" on:change={handleAudioUpload} disabled={isProcessing} />
      <label for="audio-upload" class="btn btn-primary" class:btn-disabled={isProcessing}>Upload Audio</label>
      <button class="btn" on:click={handleSplitStems} disabled={!duration || isProcessing}>Split Stems</button>
      <button class="btn" on:click={handleAnalyzeBeat} disabled={!duration || isProcessing}>Analyze Beats</button>
      {#if isProcessing}
        <span class="text-sm text-white/70 animate-pulse">{processingStatus}</span>
      {/if}
    </div>

    <!-- Beat Detection Controls -->
    <div class="space-y-4 pt-4">
      <div>
        <label for="beat-threshold" class="text-sm">Beat Detection Threshold</label>
        <p class="text-xs text-[#9CA3AF] mb-2">Lower values catch only stronger beats. Higher values include subtle beats.</p>
        <input id="beat-threshold" type="range" class="slider" min="0" max="1" step="0.01" bind:value={beatDetectionThreshold} disabled={isProcessing} />
      </div>
      <div>
        <label for="energy-threshold" class="text-sm">Loudness Threshold for Energy Jumps</label>
        <input id="energy-threshold" type="range" class="slider" min="0" max="1" step="0.01" bind:value={energyJumpThreshold} disabled={isProcessing} />
      </div>
    </div>

    <!-- Audio Player & Visualizer -->
    <div class="space-y-2 pt-4">
      <AudioVisualizer
        {beatPositions}
        {audioFile}
        on:wavesurfer={(e) => wavesurfer = e.detail}
        on:ready={handleWaveformReady}
        on:audioprocess={(e) => currentTime = e.detail.currentTime}
        on:play={() => isPlaying = true}
        on:pause={() => isPlaying = false}
        on:finish={() => { isPlaying = false; currentTime = duration; }}
      />
      <div class="flex items-center gap-4">
        <button class="text-white disabled:text-white/40" on:click={togglePlayPause} disabled={!duration}>
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            {#if isPlaying}
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            {:else}
              <path d="M8 5v14l11-7z"/>
            {/if}
          </svg>
        </button>
        <span class="text-sm text-[#9CA3AF] font-mono">
          {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} /
          {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
        </span>
        <div class="flex items-center gap-2 flex-grow">
          <svg class="w-5 h-5 text-[#9CA3AF]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input type="range" class="slider" min="0" max="1" step="0.01" bind:value={volume} on:input={handleVolumeChange} disabled={!duration} />
        </div>
      </div>
    </div>

    <!-- Video Player -->
    <div class="space-y-4 pt-4">
        <VideoPlayer {videos} bind:currentVideoIndex />
        <input type="file" accept="video/*" multiple class="hidden" id="video-upload" on:change={handleVideoUpload} />
        <label for="video-upload" class="btn w-full">Upload Videos</label>
    </div>
  </main>

  <!-- Right Sidebar -->
  <aside class="w-80 bg-[#1E293B] p-6 overflow-y-auto flex-shrink-0">
    <h2 class="text-lg font-semibold mb-4">Video Effects</h2>
    <VideoEffects />
  </aside>
</div> 