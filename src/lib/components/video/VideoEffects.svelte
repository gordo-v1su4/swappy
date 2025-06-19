<!-- src/lib/components/video/VideoEffects.svelte -->
<script>
  let beatMarkersPerShot = 5;
  let jumpCutIntensity = 0.6;
  let speedRampIntensity = 0.6;
</script>

<div class="space-y-6 p-2">
  <!-- Beat Markers Per Shot -->
  <div class="slider-container">
    <div class="flex justify-between items-center mb-2">
      <label class="text-sm text-white">Beat Markers Per Shot</label>
      <span class="text-sm text-[#9CA3AF]">{beatMarkersPerShot}</span>
    </div>
    <input
      type="range"
      class="slider"
      min="1"
      max="10"
      step="1"
      bind:value={beatMarkersPerShot}
    />
    <p class="text-xs text-[#9CA3AF] mt-1">
      Number of beat markers to wait before switching shots. Higher values mean longer shots.
    </p>
  </div>

  <!-- Jump Cut Intensity -->
  <div class="slider-container">
    <div class="flex justify-between items-center mb-2">
      <label class="text-sm text-white">Jump Cut Intensity</label>
      <span class="text-sm text-[#9CA3AF]">{(jumpCutIntensity * 100).toFixed(0)}%</span>
    </div>
    <input
      type="range"
      class="slider"
      min="0"
      max="1"
      step="0.01"
      bind:value={jumpCutIntensity}
    />
    <p class="text-xs text-[#9CA3AF] mt-1">
      Probability and intensity of random jumps
    </p>
  </div>

  <!-- Speed Ramp Intensity -->
  <div class="slider-container">
    <div class="flex justify-between items-center mb-2">
      <label class="text-sm text-white">Speed Ramp Intensity</label>
      <span class="text-sm text-[#9CA3AF]">{(speedRampIntensity * 100).toFixed(0)}%</span>
    </div>
    <input
      type="range"
      class="slider"
      min="0"
      max="1"
      step="0.01"
      bind:value={speedRampIntensity}
    />
    <p class="text-xs text-[#9CA3AF] mt-1">
      Probability and intensity of speed ramping effects
    </p>
  </div>
</div> 