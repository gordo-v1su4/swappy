<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  import WaveSurfer from 'wavesurfer.js';
  import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
  import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
  import ExportDialog from './ExportDialog.svelte';
  import AudioVisualizer from './AudioVisualizer.svelte';
  
  // Props using Svelte 5 syntax
  let {
    audioUrl = null,
    height = 128,
    waveColor = 'rgba(0, 184, 169, 0.3)',
    progressColor = 'rgba(0, 184, 169, 0.7)',
    cursorColor = '#ccff00',
    cursorWidth = 2,
    projectName = $bindable('Untitled Project'),
    // Enhanced audio management props
    masterAudio = null,
    audioStems = [],
    visibleStems = []
  } = $props();
  
  // Local state using Svelte 5 runes
  let wavesurfer = $state();
  let regionsPlugin = $state();
  let container = $state();
  let timelineContainer = $state();
  let isPlaying = $state(false);
  let duration = $state(0);
  let currentTime = $state(0);
  let volume = $state(1);
  let zoom = $state(1); // Start with minimum zoom to ensure entire track fits
  // Properties for regions and markers
  let regions = $state([]);
  let markers = $state([]);
  let activeRegion = $state(null);
  let isLoaded = $state(false);
  let isAnalyzing = $state(false);
  let songStructure = $state([]);
  let showStructureOverlay = $state(false);
  let markerName = $state('');
  let showExportDialog = $state(false);
  
  // Transient detection variables
  let isDetectingTransients = $state(false);
  let transientDensity = $state(30); // Default value, range 0-100 (reduced from 50)
  let transientRandomness = $state(50); // Default value, range 0-100 (increased from 30)
  let transientSensitivity = $state(60); // How sensitive detection is, range 0-100 (reduced from 70)
  let transientMinSpacing = $state(0.8); // Minimum time (in seconds) between transients (increased from 0.5)
  let transientMarkers = $state([]); // Store transient markers separately
  let isTransientHit = $state(false); // Indicator for transient detection light
  let transientHitTimeout = $state(null); // Timeout for turning off the hit indicator

  // Combined transients from multiple sources (master + stems)
  let combinedTransients = $state([]); // Raw transients from all included tracks
  let filteredTransients = $state([]); // Filtered transients after applying analysis controls
  
  // Speed ramping variables
  let speedRampEnabled = $state(false);
  let speedRampMaxSpeed = $state(2.0); // Maximum speed multiplier, range 0.1-3.0
  let speedRampIntensity = $state(50); // How often effect triggers (0-100%), replaces randomness
  let speedRampTrigger = $state('transients'); // 'transients', 'frequency-swell', 'bass-hits'
  let speedRampDuration = $state(4.0); // Total duration of speed ramp in seconds
  let speedRampTransitionTime = $state(1.0); // Time to ramp up/down in seconds
  let currentSpeedRamp = $state(1.0); // Current speed multiplier being applied
  let speedRampTimeout = $state(null); // Timeout for resetting speed ramp
  let speedRampActive = $state(false); // Visual indicator for when speed ramp is active
  let lastSpeedRampTime = $state(0); // Timestamp of last speed ramp to prevent spam
  let speedRampStartTime = $state(0); // When the current ramp started
  let speedRampAnimationFrame = $state(null); // Animation frame for smooth ramping
  let audioReactiveSpeed = $state(1.0); // Speed calculated from audio intensity
  let audioEnergyBuffer = $state([]); // Buffer to smooth audio energy readings
  
  // Debug effect to track speedRampActive changes
  $effect(() => {
    console.log('🔍 speedRampActive changed to:', speedRampActive, 'currentSpeedRamp:', currentSpeedRamp);
  });
  
  // Audio-reactive speed calculation
  function calculateAudioReactiveSpeed() {
    if (!wavesurfer || !isPlaying) return 1.0;
    
    try {
      // Get audio buffer data for current position
      const audioBuffer = wavesurfer.getDecodedData();
      if (!audioBuffer) return 1.0;
      
      const currentTimeSeconds = wavesurfer.getCurrentTime();
      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0);
      
      // Calculate current sample index
      const currentSample = Math.floor(currentTimeSeconds * sampleRate);
      
      // Analyze energy in a small window around current position (50ms window)
      const windowSize = Math.floor(sampleRate * 0.05); // 50ms
      const startSample = Math.max(0, currentSample - windowSize / 2);
      const endSample = Math.min(channelData.length - 1, currentSample + windowSize / 2);
      
      // Calculate RMS energy for the window
      let energy = 0;
      for (let i = startSample; i < endSample; i++) {
        energy += channelData[i] * channelData[i];
      }
      const rmsEnergy = Math.sqrt(energy / (endSample - startSample));
      
      // Smooth the energy reading
      audioEnergyBuffer.push(rmsEnergy);
      if (audioEnergyBuffer.length > 10) {
        audioEnergyBuffer.shift(); // Keep only last 10 readings
      }
      
      // Calculate smoothed energy
      const smoothedEnergy = audioEnergyBuffer.reduce((sum, val) => sum + val, 0) / audioEnergyBuffer.length;
      
      // Map energy to speed (higher energy = higher speed)
      // Energy typically ranges from 0 to 0.5, map to 1.0x to maxSpeed
      const normalizedEnergy = Math.min(1.0, smoothedEnergy * 4); // Amplify sensitivity
      const reactiveSpeed = 1.0 + (speedRampMaxSpeed - 1.0) * normalizedEnergy;
      
      return reactiveSpeed;
    } catch (error) {
      console.warn('Audio reactive calculation failed:', error);
      return 1.0;
    }
  }
  
  // Generate unique shades of blue and purple for markers
  function generateMarkerColor(index) {
    // Create different shades of blue and purple
    const hue = 230 + (index * 15) % 60; // Range from 230 (blue) to 290 (purple)
    const saturation = 60 + (index * 5) % 20; // Range from 60% to 80%
    const lightness = 40 + (index * 3) % 20; // Range from 40% to 60%
    return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.6)`;
  }
  
  // Generate colors for transient markers from yellow to red
  function generateTransientColor(position) {
    // Use position (0-1) to interpolate between yellow and red
    const hue = 60 - (position * 60); // 60 is yellow, 0 is red
    const saturation = 80 + (position * 10); // 80-90%
    const lightness = 50 - (position * 15); // 50-35%
    return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`;
  }
  
  // Create a unique ID for this instance
  const id = `waveform-${Math.random().toString(36).substring(2, 9)}`;
  const timelineId = `timeline-${Math.random().toString(36).substring(2, 9)}`;
  
  // Project title functionality from AudioEditor
  let isEditingTitle = $state(false);
  
  // Toggle project title editing
  function toggleTitleEdit() {
    isEditingTitle = !isEditingTitle;
  }
  
  // Handle title input blur
  function handleTitleBlur() {
    isEditingTitle = false;
    // Trim and set default if empty
    projectName = projectName.trim() || 'Untitled Project';
  }
  
  // Handle title input keydown
  function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
      handleTitleBlur();
    }
  }
  
  onMount(() => {
    if (!container) return;
    
    // Create WaveSurfer instance
    wavesurfer = WaveSurfer.create({
      container,
      height,
      waveColor,
      progressColor,
      cursorColor,
      cursorWidth,
      normalize: true,
      minimap: true,
      backend: 'WebAudio',
      // Ensure we're zoomed out to see the entire track initially
      fillParent: true,
      responsive: true,
      // Add this to prevent horizontal overflow
      scrollParent: false,
      // Make sure waveform fits within container
      autoCenter: true,
      plugins: [
        // Store the regions plugin reference for later use
        regionsPlugin = RegionsPlugin.create({
          dragSelection: true,
          slop: 5, // Additional pixels for regions to extend beyond their boundaries for easier selection
          opacity: 0.3
        }),
        TimelinePlugin.create({
          container: timelineContainer,
          primaryLabelInterval: 10,
          secondaryLabelInterval: 5,
          primaryColor: 'rgba(0, 0, 0, 1)',
          secondaryColor: 'rgba(0, 0, 0, 0.5)',
          primaryFontColor: '#000',
          secondaryFontColor: '#000'
        })
      ]
    });
    
    // Event listeners
    wavesurfer.on('ready', () => {
      duration = wavesurfer.getDuration();
      isLoaded = true;

      // Dispatch duration change
      dispatch('audiostate', { isPlaying, currentTime, duration });

      // Calculate the perfect zoom level to fit the entire track
      const containerWidth = container.clientWidth;
      if (containerWidth && duration) {
        // Calculate pixels per second to fit perfectly
        const minPxPerSec = containerWidth / duration;
        wavesurfer.zoom(minPxPerSec);
        zoom = 1; // Set UI zoom slider to minimum
      } else {
        // Fallback to minimum zoom
        setZoom(1);
      }
    });
    
    // Throttle audioprocess events to prevent excessive dispatching
    let lastAudioprocessTime = 0;
    wavesurfer.on('audioprocess', () => {
      const now = Date.now();
      if (now - lastAudioprocessTime > 16) { // Throttle to ~60 FPS for better precision
        lastAudioprocessTime = now;
        currentTime = wavesurfer.getCurrentTime();

        // Dispatch time update
        dispatch('audiostate', { isPlaying, currentTime, duration });

        // Check if we're hitting any transient markers
        checkTransientHit(currentTime);
      }
    });

    wavesurfer.on('play', () => {
      isPlaying = true;
      // Dispatch play state
      dispatch('audiostate', { isPlaying, currentTime, duration });
    });

    wavesurfer.on('pause', () => {
      isPlaying = false;
      // Dispatch pause state
      dispatch('audiostate', { isPlaying, currentTime, duration });
    });
    
    wavesurfer.on('region-created', region => {
      regions = [...regions, region];
      activeRegion = region;
    });
    
    wavesurfer.on('region-updated', region => {
      regions = regions.map(r => r.id === region.id ? region : r);
    });
    
    wavesurfer.on('region-clicked', region => {
      activeRegion = region;
    });
    
    wavesurfer.on('region-removed', region => {
      regions = regions.filter(r => r.id !== region.id);
      if (activeRegion && activeRegion.id === region.id) {
        activeRegion = null;
      }
    });
    
    // Load audio if URL is provided
    if (audioUrl) {
      loadAudio(audioUrl);
    }
  });
  
  onDestroy(() => {
    if (wavesurfer) {
      wavesurfer.destroy();
    }
    
    // Clean up transient hit timeout
    if (transientHitTimeout) {
      clearTimeout(transientHitTimeout);
    }
  });
  
  // Methods
  function loadAudio(url) {
    if (!wavesurfer) return;
    isLoaded = false;
    
    // Clear any existing markers and regions when loading a new file
    clearRegions();
    markers = [];
    clearTransientMarkers();
    
    wavesurfer.load(url);
    
    // Reset zoom when loading a new file
    wavesurfer.once('ready', () => {
      // Set a slight delay to ensure the waveform is fully loaded
      setTimeout(() => {
        // Calculate the perfect zoom level to fit the entire track
        const containerWidth = container.clientWidth;
        if (containerWidth && wavesurfer.getDuration()) {
          // Calculate pixels per second to fit perfectly
          const minPxPerSec = containerWidth / wavesurfer.getDuration();
          wavesurfer.zoom(minPxPerSec);
          zoom = 1; // Set UI zoom slider to minimum
        } else {
          // Fallback to minimum zoom
          setZoom(1);
        }
      }, 100);
    });
  }
  
  function togglePlay() {
    if (!wavesurfer) return;
    wavesurfer.playPause();
  }
  
  function stop() {
    if (!wavesurfer) return;
    wavesurfer.stop();
    isPlaying = false;
  }
  
  function setVolume(value) {
    if (!wavesurfer) return;
    volume = value;
    wavesurfer.setVolume(volume);
  }
  
  function setZoom(value) {
    if (!wavesurfer) return;
    zoom = value;
    
    // Calculate appropriate minPxPerSec based on current zoom level and container width
    const containerWidth = container.clientWidth;
    const trackDuration = wavesurfer.getDuration();
    
    if (trackDuration && containerWidth) {
      // At minimum zoom (1), we want the entire track to fit exactly in the container
      // At maximum zoom (100), we want much more detail
      const minPxPerSec = zoom === 1 ? 
        (containerWidth / trackDuration) : // Perfect fit at zoom level 1
        (containerWidth / trackDuration) * (1 + (zoom * 0.3)); // Gradually increase detail
        
      // Apply zoom with the calculated pixels per second
      wavesurfer.zoom(minPxPerSec);
    } else {
      // Fallback to simple zoom if we can't calculate optimal value
      wavesurfer.zoom(value);
    }
    
    // Ensure the waveform stays centered and contained
    if (wavesurfer.drawer && wavesurfer.drawer.recenter) {
      wavesurfer.drawer.recenter(wavesurfer.getCurrentTime() / wavesurfer.getDuration());
    }
  }
  
  function seekTo(position) {
    if (!wavesurfer) return;
    wavesurfer.seekTo(position / duration);
  }
  
  function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  function createRegion() {
    if (!wavesurfer || !regionsPlugin) return;
    const region = regionsPlugin.addRegion({
      start: currentTime,
      end: Math.min(currentTime + 5, duration),
      color: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`,
      drag: true,
      resize: true
    });
    
    activeRegion = region;
  }
  
  function deleteRegion() {
    if (!activeRegion) return;
    activeRegion.remove();
  }
  
  function playRegion() {
    if (!activeRegion || !wavesurfer) return;
    
    // Set playback position to region start
    wavesurfer.setTime(activeRegion.start);
    
    // Start playback
    wavesurfer.play();
  }
  
  // This is intentionally removed to fix the duplicate function issue
  
  function handleExport(event) {
    const { region, format, quality, name } = event.detail;
    
    // In a real app, you would use Web Audio API to extract and convert the audio
    // For now, we'll just show an alert with the export details
    alert(`Exporting region as ${format.toUpperCase()}:
    Name: ${name}
    Start: ${region.start.toFixed(2)}s
    End: ${region.end.toFixed(2)}s
    Quality: ${quality}
    `);
  }
  
  function exportRegion() {
    if (!activeRegion || !wavesurfer) return;
    showExportDialog = true;
  }
  
  // Marker functions
  function createMarker() {
    if (!wavesurfer || !isLoaded) return;
    
    const timePosition = wavesurfer.getCurrentTime();
    const markerId = `marker-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create marker label based on timestamp
    // Find nearest existing markers to determine number
    let markerNumber;
    
    if (markers.length === 0) {
      markerNumber = 1;
    } else {
      // Sort markers by time
      const sortedMarkers = [...markers].sort((a, b) => a.start - b.start);
      
      // Find position in the sorted array
      let insertIndex = sortedMarkers.findIndex(m => m.start > timePosition);
      if (insertIndex === -1) {
        // If it should be placed at the end
        insertIndex = sortedMarkers.length;
      }
      
      // Determine marker number
      if (insertIndex === 0) {
        // Before the first marker
        markerNumber = sortedMarkers[0].data.number / 2;
      } else if (insertIndex === sortedMarkers.length) {
        // After the last marker
        markerNumber = sortedMarkers[sortedMarkers.length - 1].data.number + 1;
      } else {
        // Between two markers
        markerNumber = (sortedMarkers[insertIndex - 1].data.number + sortedMarkers[insertIndex].data.number) / 2;
      }
    }
    
    // Generate marker color based on its number
    const markerColor = generateMarkerColor(Math.floor(markerNumber * 10));
    
    // Create a marker (using a region with small width)
    const marker = regionsPlugin.addRegion({
      id: markerId,
      start: timePosition,
      end: timePosition + 0.01, // Very small to act as a marker
      color: markerColor,
      drag: false,
      resize: false,
      data: { 
        type: 'marker', 
        number: markerNumber,
        timestamp: formatTime(timePosition)
      }
    });
    
    // Add visual indicator for the marker
    marker.element.style.width = '2px';
    marker.element.style.borderRadius = '0';
    marker.element.style.cursor = 'pointer';
    
    // Add marker label
    const label = document.createElement('div');
    label.className = 'marker-label';
    label.textContent = markerNumber.toFixed(1);
    label.style.position = 'absolute';
    label.style.top = '-20px';
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.fontSize = '10px';
    label.style.color = '#fff';
    label.style.backgroundColor = markerColor;
    label.style.padding = '1px 3px';
    label.style.borderRadius = '2px';
    marker.element.appendChild(label);
    
    markers = [...markers, marker];
    
    // Initialize song structure overlay if not already shown
    if (!showStructureOverlay && markers.length === 1) {
      showStructureOverlay = true;
      
      // Create a basic structure if none exists
      if (songStructure.length === 0) {
        songStructure = [{
          id: 'full-track',
          name: 'Full Track',
          start: 0,
          end: duration,
          color: 'rgba(0, 184, 169, 0.2)',
          startPercent: 0,
          widthPercent: 100
        }];
      }
    }
  }
  
  function deleteMarker(markerId) {
    if (!wavesurfer) return;
    
    // Find and remove the marker from the regions plugin
    const marker = regionsPlugin.getRegions().find(r => r.id === markerId);
    if (marker) {
      marker.remove();
      markers = markers.filter(m => m.id !== markerId);
    }
  }
  
  // Simplified audio analysis that creates reliable regions
  async function analyzeAudio() {
    if (!wavesurfer || !isLoaded) return;
    
    isAnalyzing = true;
    console.log('Starting audio analysis...');
    
    try {
      // First destroy any existing regions completely
      if (wavesurfer.getRegions) {
        const existingRegions = wavesurfer.getRegions();
        if (existingRegions && existingRegions.length > 0) {
          existingRegions.forEach(region => {
            try {
              if (region && region.remove) {
                region.remove();
              }
            } catch (e) {
              console.log('Error cleaning up region:', e);
            }
          });
        }
      }
      
      // Reset our regions array
      regions = [];
      
      // Wait for regions to be fully cleared
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get audio duration from wavesurfer
      const duration = wavesurfer.getDuration();
      if (!duration || duration <= 0) {
        console.error('Invalid audio duration');
        return;
      }
      
      console.log('Audio duration:', duration);
      
      // Use a consistent teal/yellow color palette for a professional look
      // Define section colors with dark teal palette
      const sectionColors = {
        intro: 'rgba(0, 104, 94, 0.4)',    // dark teal
        verse: 'rgba(0, 134, 124, 0.4)',   // medium teal
        pre: 'rgba(0, 154, 140, 0.4)',     // teal
        chorus: 'rgba(0, 184, 169, 0.4)',  // light teal
        bridge: 'rgba(0, 124, 114, 0.4)',  // dark teal
        outro: 'rgba(0, 104, 94, 0.4)'     // dark teal
      };
      
      // Create a standard song structure - simplified approach that won't cause errors
      const structureData = [];
      // We already have regions variable declared at the top
      
      // Calculate section lengths based on song duration
      let introLength, verseLength, preChorusLength, chorusLength, bridgeLength, outroLength;
      
      // Adjust section lengths based on total duration
      if (duration <= 60) { // Short track (< 1 min)
        introLength = duration * 0.1;
        outroLength = duration * 0.1;
        // No bridge for short tracks
        bridgeLength = 0;
        
        // Split remaining time between verse and chorus
        const remainingTime = duration - (introLength + outroLength);
        verseLength = remainingTime * 0.6;
        chorusLength = remainingTime * 0.4;
        preChorusLength = 0;
      } 
      else if (duration <= 180) { // Medium track (1-3 min)
        introLength = duration * 0.1;
        outroLength = duration * 0.1;
        bridgeLength = duration * 0.1;
        preChorusLength = duration * 0.1;
        
        // Split remaining time between verse and chorus
        const remainingTime = duration - (introLength + outroLength + bridgeLength + preChorusLength);
        verseLength = remainingTime * 0.6;
        chorusLength = remainingTime * 0.4;
      } 
      else { // Long track (> 3 min)
        introLength = duration * 0.08;
        outroLength = duration * 0.08;
        bridgeLength = duration * 0.12;
        preChorusLength = duration * 0.1;
        
        // Split remaining time between verse and chorus
        const remainingTime = duration - (introLength + outroLength + bridgeLength + preChorusLength);
        verseLength = remainingTime * 0.55;
        chorusLength = remainingTime * 0.45;
      }
      
      // Create each section without using wavesurfer regions first
      // This avoids race conditions
      
      // Intro
      let currentTime = 0;
      structureData.push({
        id: 'section-intro',
        name: 'Intro',
        start: currentTime,
        end: introLength,
        color: sectionColors.intro
      });
      currentTime += introLength;
      
      // First verse
      structureData.push({
        id: 'section-verse1',
        name: 'Verse 1',
        start: currentTime,
        end: currentTime + verseLength,
        color: sectionColors.verse
      });
      currentTime += verseLength;
      
      // Pre-chorus if we have one
      if (preChorusLength > 0) {
        structureData.push({
          id: 'section-pre1',
          name: 'Pre-Chorus',
          start: currentTime,
          end: currentTime + preChorusLength,
          color: sectionColors.pre
        });
        currentTime += preChorusLength;
      }
      
      // First chorus
      structureData.push({
        id: 'section-chorus1',
        name: 'Chorus 1',
        start: currentTime,
        end: currentTime + chorusLength,
        color: sectionColors.chorus
      });
      currentTime += chorusLength;
      
      // Second verse if we have enough time
      if (duration > 90) {
        structureData.push({
          id: 'section-verse2',
          name: 'Verse 2',
          start: currentTime,
          end: currentTime + verseLength,
          color: sectionColors.verse
        });
        currentTime += verseLength;
        
        // Pre-chorus if we have one
        if (preChorusLength > 0) {
          structureData.push({
            id: 'section-pre2',
            name: 'Pre-Chorus',
            start: currentTime,
            end: currentTime + preChorusLength,
            color: sectionColors.pre
          });
          currentTime += preChorusLength;
        }
        
        // Second chorus
        structureData.push({
          id: 'section-chorus2',
          name: 'Chorus 2',
          start: currentTime,
          end: currentTime + chorusLength,
          color: sectionColors.chorus
        });
        currentTime += chorusLength;
      }
      
      // Bridge if we have enough time
      if (bridgeLength > 0) {
        structureData.push({
          id: 'section-bridge',
          name: 'Bridge',
          start: currentTime,
          end: currentTime + bridgeLength,
          color: sectionColors.bridge
        });
        currentTime += bridgeLength;
        
        // Final chorus after bridge
        structureData.push({
          id: 'section-chorus3',
          name: 'Chorus 3',
          start: currentTime,
          end: currentTime + chorusLength,
          color: sectionColors.chorus
        });
        currentTime += chorusLength;
      }
      
      // Outro
      if (currentTime < duration) {
        structureData.push({
          id: 'section-outro',
          name: 'Outro',
          start: currentTime,
          end: duration,
          color: sectionColors.outro
        });
      }
      
      // Now create the visual display of the structure without using wavesurfer regions
      // This ensures we always have a visual representation even if region creation fails
      showStructureOverlay = true;
      
      // Create a deep copy for UI purposes
      const uiStructure = structureData.map(section => ({
        ...section,
        startPercent: (section.start / duration) * 100,
        widthPercent: ((section.end - section.start) / duration) * 100
      }));
      
      // Update the song structure in the UI
      songStructure = uiStructure;
      
      console.log('Song structure created:', uiStructure);
    } catch (error) {
      console.error('Error analyzing audio:', error);
      
      // Fallback to a simple structure without regions
      try {
        const duration = wavesurfer.getDuration();
        songStructure = [{
          id: 'fallback-section',
          name: 'Full Track',
          start: 0,
          end: duration,
          color: 'rgba(0, 184, 169, 0.5)', // teal
          startPercent: 0,
          widthPercent: 100
        }];
        showStructureOverlay = true;
      } catch (e) {
        console.error('Final fallback failed:', e);
      }
    } finally {
      isAnalyzing = false;
    }
  }
  
  // Helper function to clear all regions
  function clearRegions() {
    // Clear existing regions
    if (regions.length > 0) {
      regions.forEach(region => {
        try {
          if (region && region.remove) {
            region.remove();
          }
        } catch (e) {
          console.log('Error removing region:', e);
        }
      });
      regions = [];
    }
  }
  
  // Jump to a specific section in the song
  function jumpToSection(sectionId) {
    if (!wavesurfer) return;
    
    const section = songStructure.find(s => s.id === sectionId);
    if (section) {
      wavesurfer.seekTo(section.start / duration);
      currentTime = section.start;
      // Highlight the active region visually
      regions.forEach(region => {
        if (region.id === sectionId) {
          activeRegion = region;
          region.setOptions({ opacity: 0.5 });
        } else {
          region.setOptions({ opacity: 0.3 });
        }
      });
    }
  }
  
  // Update audio URL when prop changes (with duplicate prevention)
  let lastLoadedUrl = null; // NOT reactive - regular variable
  $effect(() => {
    if (wavesurfer && audioUrl && audioUrl !== lastLoadedUrl) {
      lastLoadedUrl = audioUrl;
      loadAudio(audioUrl);
    }
  });
  
  // Handle combined transients from file manager
  function handleTransientsUpdated(data) {
    combinedTransients = data.transients || [];
    console.log(`📥 Received ${combinedTransients.length} combined transients from file manager`);
    updateTransients();
  }

  // Update transients display based on current analysis controls
  function updateTransients() {
    if (!combinedTransients || combinedTransients.length === 0) {
      clearTransientMarkers();
      return;
    }

    isDetectingTransients = true;

    try {
      // Apply analysis controls to filter the combined transients
      const filtered = filterCombinedTransients(combinedTransients);

      // Clear existing transient markers
      clearTransientMarkers();

      // Create new markers for filtered transients
      filtered.forEach((transient, index) => {
        createTransientMarker(transient.time, index, filtered.length, transient.color, [transient.source]);
      });

      filteredTransients = filtered;
      console.log(`✅ Applied filters: ${transientMarkers.length} transients displayed (from ${combinedTransients.length} total)`);

    } catch (error) {
      console.error('❌ Error filtering transients:', error);
    } finally {
      isDetectingTransients = false;
    }
  }

  // Filter combined transients based on analysis controls
  function filterCombinedTransients(transients) {
    if (!transients || transients.length === 0) return [];

    // Group transients by their source stem
    const transientsByStem = transients.reduce((acc, t) => {
      const source = t.source || 'master';
      if (!acc[source]) {
        acc[source] = [];
      }
      acc[source].push(t);
      return acc;
    }, {});

    let filteredTransients = [];

    // Apply filters to each stem group independently
    for (const source in transientsByStem) {
      let stemTransients = [...transientsByStem[source]];

      // Apply density filter
      const densityFactor = transientDensity / 100;
      const targetCount = Math.ceil(stemTransients.length * densityFactor);
      if (targetCount < stemTransients.length) {
        const step = stemTransients.length / targetCount;
        const densityFiltered = [];
        for (let i = 0; i < targetCount; i++) {
          const index = Math.floor(i * step);
          if (index < stemTransients.length) {
            densityFiltered.push(stemTransients[index]);
          }
        }
        stemTransients = densityFiltered;
      }

      // Apply randomness filter
      const randomThreshold = transientRandomness / 100;
      stemTransients = stemTransients.filter(() => Math.random() > randomThreshold);
      
      // Add the filtered transients for this stem to the final list
      filteredTransients.push(...stemTransients);
    }

    // Sort the final combined list by time
    filteredTransients.sort((a, b) => a.time - b.time);

    // Apply minimum spacing filter to the final combined list
    const minSpacingSeconds = transientMinSpacing;
    const finalFiltered = [];
    let lastTime = -minSpacingSeconds;

    for (const transient of filteredTransients) {
      if (transient.time - lastTime >= minSpacingSeconds) {
        finalFiltered.push(transient);
        lastTime = transient.time;
      }
    }

    return finalFiltered;
  }

  // Create a marker for a detected transient
  function createTransientMarker(time, index, total, customColor = null, sources = null) {
    if (!wavesurfer || !regionsPlugin) return;
    
    const position = index / total; // Normalized position (0-1) for color gradient
    const markerId = `transient-${Math.random().toString(36).substring(2, 9)}`;
    const markerColor = customColor || generateTransientColor(position);
    
    // Create a marker using a region
    const marker = regionsPlugin.addRegion({
      id: markerId,
      start: time,
      end: time + 0.01, // Very small to act as a marker
      color: markerColor,
      drag: false,
      resize: false,
      data: { 
        type: 'transient',
        index: index + 1,
        timestamp: formatTime(time),
        sources: sources || ['master'] // Track which stems contributed to this transient
      }
    });
    
    // Style the marker
    marker.element.style.width = '1px';
    marker.element.style.borderRadius = '0';
    marker.element.style.opacity = '0.8';
    
    // Store the marker
    transientMarkers.push(marker);
  }
  
  // Clear all transient markers
  function clearTransientMarkers() {
    if (transientMarkers.length > 0) {
      transientMarkers.forEach(marker => {
        try {
          if (marker && marker.remove) {
            marker.remove();
          }
        } catch (e) {
          console.log('Error removing transient marker:', e);
        }
      });
      transientMarkers = [];
    }
  }
  
  // Check if the current playback position is close to any transient marker
  function checkTransientHit(time) {
    if (!isPlaying || transientMarkers.length === 0) return;
    
    // Define "hit" tolerance in seconds
    const hitTolerance = 0.05; // 50ms tolerance
    
    // Check if we're within the tolerance of any transient marker
    const isHit = transientMarkers.some(marker => 
      Math.abs(marker.start - time) < hitTolerance
    );
    
    // If we hit a marker and we're not already in a hit state
    if (isHit && !isTransientHit) {
      // Set hit state
      isTransientHit = true;
      
      // Clear any existing timeout
      if (transientHitTimeout) {
        clearTimeout(transientHitTimeout);
      }
      
      // Set timeout to turn off the hit indicator after a short time
      transientHitTimeout = setTimeout(() => {
        isTransientHit = false;
      }, 150); // Light stays on for 150ms
      
      // Trigger speed ramping if enabled and using transient trigger
      if (speedRampEnabled && speedRampTrigger === 'transients') {
        console.log('🎵 Transient hit detected, triggering speed ramp...');
        triggerSpeedRamp();
      } else {
        console.log('🔇 Speed ramp conditions not met. Enabled:', speedRampEnabled, 'Trigger:', speedRampTrigger);
      }
    }
  }
  
  // Speed ramping curve calculation
  function calculateSpeedAtTime(elapsedSeconds, targetSpeed) {
    const transitionTime = speedRampTransitionTime;
    const totalDuration = speedRampDuration;
    const holdTime = totalDuration - (2 * transitionTime);
    
    if (elapsedSeconds <= transitionTime) {
      // Ramp UP phase: 1.0 to targetSpeed
      const progress = elapsedSeconds / transitionTime;
      const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // Smooth ease in/out
      return 1.0 + (targetSpeed - 1.0) * easedProgress;
    } else if (elapsedSeconds <= transitionTime + holdTime) {
      // HOLD phase: maintain targetSpeed
      return targetSpeed;
    } else if (elapsedSeconds < totalDuration) {
      // Ramp DOWN phase: targetSpeed to 1.0
      const downPhaseStart = transitionTime + holdTime;
      const downProgress = (elapsedSeconds - downPhaseStart) / transitionTime;
      const easedProgress = 0.5 - 0.5 * Math.cos(downProgress * Math.PI); // Smooth ease in/out
      return targetSpeed - (targetSpeed - 1.0) * easedProgress;
    } else {
      // Finished
      return 1.0;
    }
  }
  
  // Smooth speed ramping animation
  function updateSpeedRamp() {
    if (!speedRampActive) return;
    
    const now = Date.now();
    const elapsedMs = now - speedRampStartTime;
    const elapsedSeconds = elapsedMs / 1000;
    
    if (elapsedSeconds >= speedRampDuration) {
      // Finished ramping
      currentSpeedRamp = 1.0;
      speedRampActive = false;
      console.log('⏮️ Speed ramp completed - returning to 1.0x');
      
      dispatch('speedramp', {
        speed: 1.0,
        duration: 100
      });
      
      if (speedRampAnimationFrame) {
        cancelAnimationFrame(speedRampAnimationFrame);
        speedRampAnimationFrame = null;
      }
    } else {
      // Calculate current speed based on curve AND audio reactivity
      audioReactiveSpeed = calculateAudioReactiveSpeed();
      const curveTargetSpeed = speedRampMaxSpeed;
      const curveSpeed = calculateSpeedAtTime(elapsedSeconds, curveTargetSpeed);
      
      // Blend curve position with audio reactivity
      // During ramp up/down: prioritize curve, during hold: prioritize audio
      const transitionTime = speedRampTransitionTime;
      const holdStartTime = transitionTime;
      const holdEndTime = speedRampDuration - transitionTime;
      
      if (elapsedSeconds >= holdStartTime && elapsedSeconds <= holdEndTime) {
        // In hold phase: blend heavily toward audio reactivity
        currentSpeedRamp = curveSpeed * 0.3 + audioReactiveSpeed * 0.7;
      } else {
        // In ramp phases: blend toward curve for smoothness
        currentSpeedRamp = curveSpeed * 0.8 + audioReactiveSpeed * 0.2;
      }
      
      // Dispatch current speed
      dispatch('speedramp', {
        speed: currentSpeedRamp,
        duration: 50 // Frequent updates for smooth ramping
      });
      
      // Schedule next update
      speedRampAnimationFrame = requestAnimationFrame(updateSpeedRamp);
    }
  }
  
  // Speed ramping trigger logic
  function triggerSpeedRamp() {
    if (!speedRampEnabled) {
      console.log('🚫 Speed ramp not enabled');
      return;
    }
    
    // Prevent spam - minimum time between ramps
    const now = Date.now();
    const cooldownTime = speedRampDuration * 1000 + 1000; // Duration + 1 second
    if (now - lastSpeedRampTime < cooldownTime) {
      console.log('⏱️ Speed ramp cooldown active');
      return;
    }
    
    console.log('🎯 Speed ramp triggered! Intensity:', speedRampIntensity + '%');
    
    // Apply intensity (higher intensity = higher chance of triggering)
    const randomChance = Math.random() * 100;
    if (randomChance < speedRampIntensity) {
      lastSpeedRampTime = now;
      speedRampStartTime = now;
      speedRampActive = true;
      
      const targetSpeed = speedRampMaxSpeed * (0.8 + Math.random() * 0.4);
      console.log('🚀 Starting speed ramp curve to', targetSpeed.toFixed(2) + 'x over', speedRampDuration, 'seconds');
      console.log('📈 Ramp up:', speedRampTransitionTime + 's, Hold:', (speedRampDuration - 2 * speedRampTransitionTime).toFixed(1) + 's, Ramp down:', speedRampTransitionTime + 's');
      
      // Start the smooth ramping animation
      if (speedRampAnimationFrame) {
        cancelAnimationFrame(speedRampAnimationFrame);
      }
      speedRampAnimationFrame = requestAnimationFrame(updateSpeedRamp);
      
    } else {
      console.log('🎲 Intensity check failed (', randomChance.toFixed(1), '% >=', speedRampIntensity + '%)');
    }
  }
  
  // Export methods to get markers for VideoEditor
  export function getTransientMarkers() {
    return transientMarkers.map(marker => ({
      start: marker.start,
      type: 'transient',
      data: marker.data
    }));
  }
  
  // Export speed ramping state
  export function getSpeedRampState() {
    return {
      enabled: speedRampEnabled,
      currentSpeed: currentSpeedRamp,
      maxSpeed: speedRampMaxSpeed,
      intensity: speedRampIntensity,
      trigger: speedRampTrigger,
      duration: speedRampDuration,
      transitionTime: speedRampTransitionTime,
      active: speedRampActive,
      audioReactiveSpeed: audioReactiveSpeed
    };
  }
  
  export function getUserMarkers() {
    return markers.map(marker => ({
      start: marker.start,
      type: 'user',
      data: marker.data
    }));
  }

  // Export the transients update handler for external access
  export { handleTransientsUpdated, updateTransients };
  
  // Dispatch markers update event when markers change (with throttling to prevent loops)
  let lastMarkerDispatchTime = 0; // NOT reactive - regular variable
  let lastTransientCount = 0; // NOT reactive - regular variable  
  let lastUserMarkersCount = 0; // NOT reactive - regular variable
  $effect(() => {
    const currentTransientCount = transientMarkers.length;
    const currentUserMarkersCount = markers.length;
    const now = Date.now();
    
    // Only dispatch if counts actually changed and enough time has passed
    if ((currentTransientCount !== lastTransientCount || currentUserMarkersCount !== lastUserMarkersCount) 
        && (now - lastMarkerDispatchTime > 200)) {
      lastTransientCount = currentTransientCount;
      lastUserMarkersCount = currentUserMarkersCount;
      lastMarkerDispatchTime = now;
      
      if (currentTransientCount > 0 || currentUserMarkersCount > 0) {
        dispatch('markersupdate', {
          transientMarkers: getTransientMarkers(),
          userMarkers: getUserMarkers()
        });
      }
    }
  });
</script>

<style>
  /* Dark mode theme */
  .audio-timeline {
    width: 100%;
    padding: 15px;
    background-color: #1e1e1e;
    border-radius: 8px;
    margin-bottom: 20px;
    color: #e4e4e7; /* zinc-200 */
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-x: hidden;
  }
  
  .project-header {
    display: flex;
    justify-content: center;
    margin-bottom: 15px;
  }
  
  .project-title {
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    padding: 5px 10px;
    border-radius: 4px;
    color: #e4e4e7; /* zinc-200 */
    transition: background-color 0.2s;
    display: inline-block;
  }
  
  .project-title:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .title-input {
    background-color: #27272a; /* zinc-800 */
    border: 1px solid #52525b; /* zinc-600 */
    color: #e4e4e7; /* zinc-200 */
    font-size: 18px;
    padding: 5px 10px;
    border-radius: 4px;
    text-align: center;
  }
  
  .title-input:focus {
    outline: none;
    border-color: #00b8a9;
  }

  .waveform-container {
    width: 100%;
    background-color: #18181b; /* zinc-900 */
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    background-color: #121212;
    box-sizing: border-box;
    max-width: 100%;
  }

  .timeline-container {
    width: 100%;
    height: 30px;
    background-color: #27272a; /* zinc-800 */
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    border-top: 1px solid #3f3f46; /* zinc-700 */
    overflow: hidden;
    box-sizing: border-box;
  }

  .controls {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .transport-controls {
    display: flex;
    gap: 5px;
  }

  .button {
    background-color: #121212;
    color: #e6e6e6;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    letter-spacing: 0.5px;
    font-family: 'Inter', sans-serif;
    text-transform: uppercase;
    min-width: 70px;
  }

  .button:hover {
    background-color: #1a1a1a;
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.5);
    border-color: #00b8a9;
  }

  .button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .button:disabled {
    background-color: #1a1a1a;
    border-color: #333;
    color: #666;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .time-info {
    font-size: 14px;
    color: #a1a1aa; /* zinc-400 */
    margin: 0 10px;
    min-width: 100px;
    font-weight: 500;
  }

  .slider-container {
    display: flex;
    align-items: center;
    margin-left: 10px;
  }

  .slider-label {
    margin-right: 5px;
    font-size: 14px;
    color: #a1a1aa; /* zinc-400 */
    font-weight: 500;
  }

  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 80px;
    height: 3px;
    border-radius: 2px;
    background: #333;
    outline: none;
  }

  .slider-teal::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: #00b8a9;
    cursor: pointer;
  }
  
  .slider-teal::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: #00b8a9;
    cursor: pointer;
    border: none;
  }

  .region-controls {
    display: flex;
    align-items: center;
    margin-top: 15px;
    gap: 10px;
    flex-wrap: wrap;
  }

  .analyze-button {
    background-color: #00b8a9;
    color: #121212;
    border-color: transparent;
  }

  .analyze-button:hover {
    background-color: #00cebb;
    box-shadow: 0 3px 8px rgba(0, 184, 169, 0.4);
  }

  .analyze-button:active {
    background-color: #00a396;
  }

  .analyze-button:disabled {
    background-color: #1a1a1a;
    color: #666;
    border-color: #333;
  }

  .song-structure {
    margin-top: 20px;
    padding: 15px;
    background-color: #18181b; /* zinc-900 */
    border-radius: 8px;
    border: 1px solid #3f3f46; /* zinc-700 */
  }

  .structure-overlay {
    position: relative;
    height: 30px;
    width: 100%;
    background-color: #27272a; /* zinc-800 */
    border-radius: 4px;
    margin-bottom: 10px;
    overflow: hidden;
    border: 1px solid #3f3f46; /* zinc-700 */
  }
  
  /* Used in the song section display */
  .section-item {
    background-color: rgba(0, 184, 169, 0.15);
    padding: 4px 6px;
    border-radius: 3px;
    margin-bottom: 3px;
    cursor: pointer;
    font-size: 11px;
    border: 1px solid rgba(0, 184, 169, 0.3);
  }

  .structure-section {
    position: absolute;
    top: 0;
    height: 100%;
    min-width: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-right: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .section-label {
    color: white;
    font-size: 10px;
    font-weight: bold;
    white-space: nowrap;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.7);
    padding: 0 4px;
  }

  .song-structure h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 14px;
    color: #e6e6e6;
  }
  
  .structure-sections {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .section-button {
    padding: 3px 6px;
    border: none;
    border-radius: 2px;
    color: #fff;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: rgba(0, 134, 124, 0.7);
    border: 1px solid rgba(0, 184, 169, 0.3);
  }
  
  .section-button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100px;
    width: 100%;
    font-style: italic;
    color: #666;
  }

  .marker-item {
    position: absolute;
    bottom: 30px;
    transform: translateX(-50%);
    background-color: #2d2d2d;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 9px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    white-space: nowrap;
    z-index: 10;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease;
  }
  
  .marker-item:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
  }
  
  .marker-timestamp {
    color: #e4e4e7;
    font-weight: 500;
  }
  
  .marker-number {
    opacity: 0.8;
    margin-right: 3px;
  }
  
  .marker-indicator {
    position: absolute;
    width: 2px;
    height: 100%;
    top: 0;
    transform: translateX(-50%);
  }
  
  .marker-delete {
    background: none;
    border: none;
    color: #ff6b6b;
    cursor: pointer;
    font-size: 11px;
    padding: 0 0 0 3px;
    margin-left: 3px;
    line-height: 1;
    opacity: 0.6;
  }
  
  .marker-delete:hover {
    opacity: 1;
  }

  .marker-button {
    background-color: #4b5eab; /* Blue-purple shade */
    color: white;
    border-color: transparent;
  }
  
  .marker-button:hover {
    background-color: #5b6ecb;
    box-shadow: 0 3px 8px rgba(75, 94, 171, 0.4);
  }
  
  .marker-button:active {
    background-color: #3b4e9b;
  }
  
  .marker-button:disabled {
    background-color: #1a1a1a;
    color: #666;
    border-color: #333;
  }
  
  .analysis-controls {
    margin-top: 20px;
    padding: 15px;
    background-color: #18181b; /* zinc-900 */
    border-radius: 8px;
    border: 1px solid #3f3f46; /* zinc-700 */
  }
  
  .analysis-section {
    margin-bottom: 15px;
  }
  
  .analysis-section:last-child {
    margin-bottom: 0;
  }
  
  .analysis-controls h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 16px;
    color: #e6e6e6;
    border-bottom: 1px solid #3f3f46;
    padding-bottom: 8px;
  }
  
  .analysis-controls h3 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 14px;
    color: #e6e6e6;
  }
  
  .analysis-sliders {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  
  @media (max-width: 992px) {
    .analysis-sliders {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 576px) {
    .analysis-sliders {
      grid-template-columns: 1fr;
    }
  }
  
  .speed-ramp-controls {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-top: 10px;
  }
  
  @media (max-width: 992px) {
    .speed-ramp-controls {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 576px) {
    .speed-ramp-controls {
      grid-template-columns: 1fr;
    }
  }
  
  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .slider-group label {
    font-size: 12px;
    color: #a1a1aa;
  }
  
  .slider-value {
    font-size: 11px;
    color: #a1a1aa;
    margin-left: 5px;
    opacity: 0.8;
  }
  
  .detect-button {
    background-color: #e9b83c; /* amber/yellow */
    color: #121212;
    border-color: transparent;
    margin-top: 15px;
  }
  
  .detect-button:hover {
    background-color: #f9d862;
    box-shadow: 0 3px 8px rgba(233, 184, 60, 0.4);
  }
  
  .detect-button:active {
    background-color: #d9a82c;
  }
  
  .detect-button:disabled {
    background-color: #1a1a1a;
    color: #666;
    border-color: #333;
  }
  
  .speed-toggle {
    background-color: #8b5cf6; /* violet */
    color: white;
    border-color: transparent;
    margin-top: 10px;
  }
  
  .speed-toggle:hover {
    background-color: #a78bfa;
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }
  
  .speed-toggle:active {
    background-color: #7c3aed;
  }
  
  .speed-toggle.enabled {
    background-color: #10b981; /* emerald */
  }
  
  .speed-toggle.enabled:hover {
    background-color: #34d399;
    box-shadow: 0 3px 8px rgba(16, 185, 129, 0.4);
  }
  
  .speed-toggle.enabled:active {
    background-color: #059669;
  }
  
  .analysis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .detection-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #333;
    border: 1px solid #444;
    transition: all 0.1s ease;
    position: relative;
  }
  
  .detection-indicator.hit {
    background-color: #f5a623; /* Orange/yellow */
    box-shadow: 0 0 8px 2px rgba(245, 166, 35, 0.7);
    border-color: #f5a623;
  }
  
  .detection-indicator::after {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .detection-indicator.hit::after {
    opacity: 1;
  }
  
  .speed-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #1a1a1a; /* Darker when inactive */
    border: 1px solid #333;
    transition: all 0.2s ease;
    position: relative;
    --speed-intensity: 0;
  }
  
  .speed-indicator.active {
    /* Dynamic background based on speed intensity - from dark to bright purple */
    background-color: rgb(
      calc(26 + (139 - 26) * var(--speed-intensity)), 
      calc(26 + (92 - 26) * var(--speed-intensity)), 
      calc(26 + (246 - 26) * var(--speed-intensity))
    );
    /* Dynamic glow based on speed intensity */
    box-shadow: 0 0 calc(2px + 10px * var(--speed-intensity)) calc(0px + 4px * var(--speed-intensity)) 
      rgba(139, 92, 246, calc(0.1 + 0.9 * var(--speed-intensity)));
    border-color: rgb(
      calc(51 + (139 - 51) * var(--speed-intensity)), 
      calc(51 + (92 - 51) * var(--speed-intensity)), 
      calc(51 + (246 - 51) * var(--speed-intensity))
    );
  }
  
  .speed-indicator::after {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, calc(0.1 + 0.3 * var(--speed-intensity)));
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .speed-indicator.active::after {
    opacity: 1;
  }
  
  .glowy-yellow {
    color: #ffef00;
    text-shadow: 0 0 5px rgba(255, 239, 0, 0.7);
  }
</style>

<div class="audio-timeline">
  <!-- Project title editor (from AudioEditor) -->
  <div class="project-header">
    {#if isEditingTitle}
      <input
        type="text"
        class="title-input"
        bind:value={projectName}
        onblur={handleTitleBlur}
        onkeydown={handleTitleKeydown}
      />
    {:else}
      <div 
        class="project-title" 
        onclick={toggleTitleEdit}
        onkeydown={(e) => e.key === 'Enter' && toggleTitleEdit()}
        tabindex="0"
        role="button"
        aria-label="Edit project title">
        {projectName}
      </div>
    {/if}
  </div>
  
  <div class="waveform-container" bind:this={container} id={id}></div>
  <div class="timeline-container" bind:this={timelineContainer} id={timelineId}></div>
  
  {#if !isLoaded && audioUrl}
    <div class="loading">Loading audio waveform...</div>
  {/if}
  
  <div class="controls">
    <div class="transport-controls">
      <button 
        class="button" 
        onclick={togglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {#if isPlaying}
          Stop
        {:else}
          Play
        {/if}
      </button>
    </div>
    
    <div class="time-info">
      {formatTime(currentTime)} / {formatTime(duration)}
    </div>
    
    <div class="slider-container">
      <span class="slider-label">Volume</span>
      <input
        type="range"
        class="slider slider-teal"
        min="0"
        max="1"
        step="0.05"
        bind:value={volume}
        oninput={() => setVolume(volume)}
      />
    </div>

    <div class="slider-container">
      <span class="slider-label">Zoom</span>
      <input
        type="range"
        class="slider slider-teal"
        min="1"
        max="20"
        step="0.5"
        bind:value={zoom}
        oninput={() => setZoom(zoom)}
      />
    </div>
  </div>
  
  <div class="region-controls">
    <button
      class="button"
      onclick={createRegion}
      disabled={!isLoaded}
    >
      Create Region
    </button>

    <button
      class="button"
      onclick={playRegion}
      disabled={!activeRegion}
    >
      Play Region
    </button>

    <button
      class="button"
      onclick={deleteRegion}
      disabled={!activeRegion}
    >
      Delete Region
    </button>

    <button
      class="button"
      onclick={exportRegion}
      disabled={!activeRegion}
    >
      Export Region
    </button>
    
    <button
      class="button marker-button"
      onclick={createMarker}
      disabled={!isLoaded}
    >
      Add Timestamp
    </button>
    
    <button
      class="button analyze-button"
      onclick={analyzeAudio}
      disabled={!isLoaded || isAnalyzing}
    >
      {#if isAnalyzing}
        <span class="loading"></span> Analyzing...
      {:else}
        Analyze Audio
      {/if}
    </button>
  </div>
  
  <!-- Analysis Controls -->
  <div class="analysis-controls">
    <!-- Transient Detection Section -->
    <div class="analysis-section">
      <div class="analysis-header">
        <h3>Transient Detection</h3>
        <div class="transient-info">
          <div class="detection-indicator" class:hit={isTransientHit}></div>
        </div>
      </div>
      
      <div class="analysis-sliders">
        <div class="slider-group">
          <label for="density-slider">Density <span class="slider-value">{transientDensity}%</span></label>
          <input
            id="density-slider"
            type="range"
            class="slider slider-teal"
            min="1"
            max="100"
            bind:value={transientDensity}
          />
        </div>
        
        <div class="slider-group">
          <label for="randomness-slider">Randomness <span class="slider-value">{transientRandomness}%</span></label>
          <input
            id="randomness-slider"
            type="range"
            class="slider slider-teal"
            min="0"
            max="100"
            bind:value={transientRandomness}
          />
        </div>
        
        <div class="slider-group">
          <label for="sensitivity-slider">Sensitivity <span class="slider-value">{transientSensitivity}%</span></label>
          <input
            id="sensitivity-slider"
            type="range"
            class="slider slider-teal"
            min="1"
            max="100"
            bind:value={transientSensitivity}
          />
        </div>
        
        <div class="slider-group">
          <label for="spacing-slider">Min Spacing <span class="slider-value">{transientMinSpacing.toFixed(2)}s</span></label>
          <input
            id="spacing-slider"
            type="range"
            class="slider slider-teal"
            min="0"
            max="2"
            step="0.05"
            bind:value={transientMinSpacing}
          />
        </div>
      </div>
      
      <button
        class="button detect-button"
        onclick={updateTransients}
        disabled={!isLoaded || isDetectingTransients}
      >
        {#if isDetectingTransients}
          <span class="loading"></span> Applying Filters...
        {:else}
          Apply Filters
        {/if}
      </button>
    </div>
    
    <!-- Speed Ramping Section -->
    <div class="analysis-section">
      <div class="analysis-header">
        <h3>Speed Ramping</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div 
            class="speed-indicator" 
            class:active={speedRampActive} 
            style="--speed-intensity: {speedRampActive ? Math.min(1.0, Math.max(0.0, (currentSpeedRamp - 1.0) / (speedRampMaxSpeed - 1.0))) : 0}"
            title="Speed: {currentSpeedRamp.toFixed(1)}x | Audio: {audioReactiveSpeed.toFixed(1)}x | Active: {speedRampActive ? 'YES' : 'NO'}"
          ></div>
          <button
            class="button speed-toggle"
            class:enabled={speedRampEnabled}
            onclick={() => speedRampEnabled = !speedRampEnabled}
          >
            {speedRampEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
      
      {#if speedRampEnabled}
        <div class="speed-ramp-controls">
          <div class="slider-group">
            <label for="speed-max-slider">Max Speed <span class="slider-value">{speedRampMaxSpeed.toFixed(1)}x</span></label>
            <input
              id="speed-max-slider"
              type="range"
              class="slider slider-teal"
              min="1.1"
              max="5.0"
              step="0.1"
              bind:value={speedRampMaxSpeed}
            />
          </div>
          
          <div class="slider-group">
            <label for="speed-intensity-slider">Effect Intensity <span class="slider-value">{speedRampIntensity}%</span></label>
            <input
              id="speed-intensity-slider"
              type="range"
              class="slider slider-teal"
              min="0"
              max="100"
              bind:value={speedRampIntensity}
            />
          </div>
          
          <div class="slider-group">
            <label for="speed-duration-slider">Total Duration <span class="slider-value">{speedRampDuration.toFixed(1)}s</span></label>
            <input
              id="speed-duration-slider"
              type="range"
              class="slider slider-teal"
              min="1.0"
              max="12.0"
              step="0.5"
              bind:value={speedRampDuration}
            />
          </div>
          
          <div class="slider-group">
            <label for="speed-transition-slider">Ramp Time <span class="slider-value">{speedRampTransitionTime.toFixed(1)}s</span></label>
            <input
              id="speed-transition-slider"
              type="range"
              class="slider slider-teal"
              min="0.5"
              max="3.0"
              step="0.1"
              bind:value={speedRampTransitionTime}
            />
          </div>
        </div>
        
        <div class="slider-group" style="margin-top: 10px;">
          <label for="trigger-select">Trigger Type</label>
          <select
            id="trigger-select"
            bind:value={speedRampTrigger}
            style="padding: 5px; background-color: #27272a; color: #e6e6e6; border: 1px solid #3f3f46; border-radius: 4px;"
          >
            <option value="transients">Transients</option>
            <option value="frequency-swell">Frequency Swells</option>
            <option value="bass-hits">Bass Hits</option>
          </select>
        </div>
      {/if}
    </div>
  </div>
  
  {#if songStructure.length > 0}
    <div class="song-structure">
      <h3>Song Structure</h3>
      
      {#if showStructureOverlay}
        <div class="structure-overlay">
          {#each songStructure as section}
            <div 
              class="structure-section" 
              style="left: {section.startPercent}%; width: {section.widthPercent}%; background-color: {section.color};"
              title="{section.name}: {formatTime(section.start)} - {formatTime(section.end)}"
            >
              <span class="section-label">{section.name}</span>
            </div>
          {/each}
          
          <!-- Render user-created markers -->
          {#each markers as marker}
            <div
              class="marker-indicator"
              style="left: {(marker.start / duration) * 100}%; background-color: {marker.color};"
            ></div>
            <div 
              class="marker-item"
              style="left: {(marker.start / duration) * 100}%; border-color: {marker.color};"
            >
              <span class="marker-number">{marker.data && marker.data.number ? marker.data.number.toFixed(1) : ''}</span>
              <span class="marker-timestamp">{marker.data && marker.data.timestamp ? marker.data.timestamp : formatTime(marker.start)}</span>
              <button 
                class="marker-delete" 
                aria-label="Delete marker"
                onclick={() => deleteMarker(marker.id)}
              >
                ×
              </button>
            </div>
          {/each}
          
          <!-- Render transient markers (just the indicator lines, not the labels to avoid clutter) -->
          {#each transientMarkers as marker}
            <div
              class="marker-indicator transient-indicator"
              style="left: {(marker.start / duration) * 100}%; background-color: {marker.color}; opacity: 0.6;"
              title="Transient at {marker.data && marker.data.timestamp ? marker.data.timestamp : formatTime(marker.start)}"
            ></div>
          {/each}
        </div>
      {/if}
      
      <div class="structure-sections">
        {#each songStructure as section}
          <div class="section-item">
            <button 
              class="section-button"
              style="background-color: {section.color};"
              onclick={() => jumpToSection(section.id)}
            >
              {section.name} ({formatTime(section.start)} - {formatTime(section.end)})
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- File upload is handled by AudioFileManager component -->
</div>

<!-- Export Dialog -->
<ExportDialog 
  bind:show={showExportDialog}
  region={activeRegion}
  projectName={projectName}
  on:export={handleExport}
/>

<!-- Audio Visualizer (now without its own play button) -->
{#if isLoaded && audioUrl}
  <AudioVisualizer audioUrl={audioUrl} />
{/if}
