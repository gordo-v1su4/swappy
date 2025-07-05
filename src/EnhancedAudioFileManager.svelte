<script>
  // Props - including callback props for events
  let {
    maxFiles = 5,
    onMasterSelected,
    onStemsUpdated,
    onTransientsUpdated,
    onSelect
  } = $props();
  
  // Local state using Svelte 5 runes
  let projectTree = $state({
    masterSong: null,
    stems: [],
    expanded: {
      master: true,  // Start expanded when master is uploaded
      stems: true
    }
  });

  // Debug logging for component state
  $effect(() => {
    console.log('🎵 EnhancedAudioFileManager state:', {
      masterSong: projectTree.masterSong?.name || 'null',
      stemsCount: projectTree.stems.length
    });
  });



  let stemTypes = [
    {
      id: 'lead-vocals',
      name: 'Lead Vocals',
      color: '#3b82f6', // Blue
      bgColor: 'rgba(59, 130, 246, 0.1)'
    },
    {
      id: 'backing-vocals',
      name: 'Backing Vocals',
      color: '#06b6d4', // Cyan
      bgColor: 'rgba(6, 182, 212, 0.1)'
    },
    {
      id: 'drums',
      name: 'Drums',
      color: '#00b8a9', // Teal (matching main theme)
      bgColor: 'rgba(0, 184, 169, 0.1)'
    },
    {
      id: 'bass',
      name: 'Bass',
      color: '#8b5cf6', // Purple
      bgColor: 'rgba(139, 92, 246, 0.1)'
    },
    {
      id: 'percussion',
      name: 'Percussion',
      color: '#a855f7', // Violet
      bgColor: 'rgba(168, 85, 247, 0.1)'
    },
    {
      id: 'synth',
      name: 'Synth',
      color: '#ec4899', // Pink
      bgColor: 'rgba(236, 72, 153, 0.1)'
    },
    {
      id: 'other',
      name: 'Other',
      color: '#6b7280', // Gray
      bgColor: 'rgba(107, 114, 128, 0.1)'
    }
  ];

  // File input references
  let masterFileInput = $state();
  let stemFileInput = $state();
  let jsonFileInput = $state();
  let targetStemType = $state(null);
  
  // Utility functions
  function generateId() {
    return `id-${Math.random().toString(36).substring(2, 9)}`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // Save transients to JSON file
  function saveTransientsToJson(projectData) {
    const transientData = {
      projectName: projectData.name || 'Untitled Project',
      timestamp: new Date().toISOString(),
      masterSong: projectData.masterSong ? {
        name: projectData.masterSong.name,
        duration: projectData.masterSong.duration,
        transients: projectData.masterSong.transients,
        included: projectData.masterSong.included
      } : null,
      stems: projectData.stems.map(stem => ({
        id: stem.id,
        type: stem.type,
        name: stem.name,
        color: stem.color,
        duration: stem.duration,
        transients: stem.transients,
        included: stem.included,
        visible: stem.visible
      }))
    };

    const jsonString = JSON.stringify(transientData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${transientData.projectName.replace(/[^a-z0-9]/gi, '_')}_transients.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('💾 Transients saved to JSON file');
  }

  // Load transients from JSON file
  async function loadTransientsFromJson(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      console.log('📂 Loading transients from JSON:', data.projectName);

      // Apply loaded transients to current project
      if (data.masterSong && projectTree.masterSong) {
        projectTree.masterSong.transients = data.masterSong.transients || [];
        projectTree.masterSong.duration = data.masterSong.duration || 0;
        projectTree.masterSong.included = data.masterSong.included !== undefined ? data.masterSong.included : true;
        projectTree.masterSong.analyzing = false;
        console.log(`📂 Loaded ${projectTree.masterSong.transients.length} master transients`);
      }

      // Match stems by type and apply transients
      data.stems.forEach(savedStem => {
        const currentStem = projectTree.stems.find(s => s.type === savedStem.type);
        if (currentStem) {
          currentStem.transients = savedStem.transients || [];
          currentStem.duration = savedStem.duration || 0;
          currentStem.included = savedStem.included !== undefined ? savedStem.included : true;
          currentStem.visible = savedStem.visible !== undefined ? savedStem.visible : true;
          currentStem.analyzing = false;
          console.log(`📂 Loaded ${currentStem.transients.length} transients for ${currentStem.type}`);
        }
      });

      // Force reactivity update
      projectTree = { ...projectTree };

      // Update combined transients
      updateCombinedTransients();

      console.log('✅ Transients loaded successfully from JSON');
      return true;

    } catch (error) {
      console.error('❌ Failed to load transients from JSON:', error);
      return false;
    }
  }

  // Handle JSON file upload
  async function handleJsonUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const success = await loadTransientsFromJson(file);
    if (success) {
      console.log('✅ JSON transients loaded successfully');
    }

    event.target.value = '';
  }

  function inferStemType(filename) {
    const name = filename.toLowerCase();
    
    // Lead Vocals
    if (name.includes('lead') && name.includes('vocal')) return 'lead-vocals';
    if (name.includes('main') && name.includes('vocal')) return 'lead-vocals';
    if (name.includes('vocal') && !name.includes('back')) return 'lead-vocals';
    
    // Backing Vocals
    if (name.includes('backing') && name.includes('vocal')) return 'backing-vocals';
    if (name.includes('back') && name.includes('vocal')) return 'backing-vocals';
    if (name.includes('harmony') || name.includes('choir')) return 'backing-vocals';
    
    // Drums
    if (name.includes('drum') || name.includes('kick') || name.includes('snare')) return 'drums';
    if (name.includes('kit')) return 'drums';
    
    // Bass
    if (name.includes('bass')) return 'bass';
    
    // Percussion
    if (name.includes('percussion') || name.includes('perc')) return 'percussion';
    if (name.includes('shaker') || name.includes('tambourine')) return 'percussion';
    if (name.includes('conga') || name.includes('bongo')) return 'percussion';
    
    // Synth
    if (name.includes('synth') || name.includes('pad') || name.includes('lead')) return 'synth';
    if (name.includes('keys') || name.includes('piano')) return 'synth';
    
    return 'other';
  }

  function getStemDetectionSettings(stemType) {
    const settings = {
      'lead-vocals': { 
        sensitivity: 35, 
        minSpacing: 0.4, 
        density: 25,
        description: 'Optimized for vocal phrases and emphasis'
      },
      'backing-vocals': { 
        sensitivity: 30, 
        minSpacing: 0.6, 
        density: 20,
        description: 'Captures harmony entrances and vocal swells'
      },
      'drums': { 
        sensitivity: 75, 
        minSpacing: 0.1, 
        density: 60,
        description: 'High sensitivity for kick, snare, and cymbal hits'
      },
      'bass': { 
        sensitivity: 60, 
        minSpacing: 0.5, 
        density: 40,
        description: 'Detects bass note attacks and rhythm changes'
      },
      'percussion': { 
        sensitivity: 65, 
        minSpacing: 0.2, 
        density: 50,
        description: 'Captures shakers, tambourines, and auxiliary percussion'
      },
      'synth': { 
        sensitivity: 45, 
        minSpacing: 0.3, 
        density: 35,
        description: 'Detects synth stabs, chord changes, and lead lines'
      },
      'other': { 
        sensitivity: 50, 
        minSpacing: 0.3, 
        density: 40,
        description: 'General purpose detection for mixed instruments'
      }
    };
    return settings[stemType] || settings.other;
  }

  // Tree navigation
  function toggleSection(section) {
    projectTree.expanded[section] = !projectTree.expanded[section];
    // Force reactivity update
    projectTree = { ...projectTree };
  }

  // File upload handlers
  function openMasterUpload() {
    masterFileInput.click();
  }

  function openStemUpload(stemType = null) {
    console.log(`🎯 openStemUpload called with stemType: ${stemType}`);

    try {
      targetStemType = stemType;
      console.log(`🎯 Set targetStemType to: ${targetStemType}`);

      if (!stemFileInput) {
        console.error('❌ stemFileInput is not available');
        return;
      }

      console.log('🎯 Triggering file input click...');
      stemFileInput.click();
      console.log('✅ File input click triggered successfully');

    } catch (error) {
      console.error('❌ Error in openStemUpload:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        stemType,
        stemFileInputExists: !!stemFileInput
      });
    }
  }

  async function handleMasterUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    projectTree.masterSong = {
      id: generateId(),
      name: file.name,
      file: file,
      url: URL.createObjectURL(file),
      size: file.size,
      analyzing: true,
      transients: [],
      included: true, // Always include master by default - user can toggle off manually
      visible: true,
      duration: 0 // Will be set during transient detection
    };
    
    // Call callback for AudioTimeline waveform display
    onMasterSelected?.(projectTree.masterSong);
    
    // Auto-detect transients for master
    setTimeout(() => {
      detectMasterTransients();
    }, 500);
    
    event.target.value = '';
  }

  async function handleStemUpload(event) {
    try {
      console.log('🎯 handleStemUpload called', {
        filesCount: event.target.files?.length,
        targetStemType,
        eventType: event.type,
        hasFiles: !!event.target.files,
        firstFileName: event.target.files?.[0]?.name
      });

      const files = Array.from(event.target.files);

      if (!files.length) {
        console.warn('No files selected for upload');
        return;
      }

      for (const file of files) {
        try {
          console.log(`Processing file: ${file.name}`, {
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          });

          const stemType = targetStemType || inferStemType(file.name);
          console.log(`Determined stem type: ${stemType} for file: ${file.name}`);

          const stemConfig = stemTypes.find(t => t.id === stemType);

          if (!stemConfig) {
            console.error(`No stem config found for type: ${stemType}`, { availableTypes: stemTypes.map(t => t.id) });
            continue;
          }

          // Create lightweight stem entry (no audio file stored)
          const stem = {
            id: generateId(),
            name: file.name,
            size: file.size,
            type: stemType,
            color: stemConfig.color,
            bgColor: stemConfig.bgColor,
            included: true, // Include by default
            visible: true,
            analyzing: true,
            transients: [], // Store 100% of analyzed transients
            duration: 0 // Will be set during transient detection
          };

          console.log(`Created stem object:`, {
            id: stem.id,
            name: stem.name,
            type: stem.type,
            analyzing: stem.analyzing,
            color: stem.color
          });

          // Replace existing stem of same type or add new
          const existingIndex = projectTree.stems.findIndex(s => s.type === stemType);
          if (existingIndex >= 0) {
            console.log(`Replacing existing stem at index ${existingIndex} for type ${stemType}`);
            projectTree.stems[existingIndex] = stem;
          } else {
            console.log(`Adding new stem for type ${stemType}`);
            projectTree.stems.push(stem);
          }

          console.log(`Current stems in project:`, projectTree.stems.map(s => ({ name: s.name, type: s.type, analyzing: s.analyzing })));

          // Extract transients immediately and discard audio
          console.log(`Starting transient extraction for uploaded stem: ${stem.name} (${stem.type})`);

          // Extract REAL transients from actual audio data
          try {
            // Prevent multiple detections for same stem
            if (stemDetectionInProgress.has(stem.type) || stem.transients.length > 0) {
              console.log(`🔄 Stem ${stem.type} already has transients or analyzing, skipping detection...`);
              stem.analyzing = false;
              return;
            }

            stemDetectionInProgress.add(stem.type);

            const result = await analyzeAudioForTransients(file, stem.type);
            stem.transients = result.transients;
            stem.duration = result.duration;
            stem.analyzing = false;
            console.log(`✅ Found ${result.transients.length} transients in ${stem.name}`);
            console.log(`🔍 DEBUG: Stem state after detection:`, {
              name: stem.name,
              type: stem.type,
              analyzing: stem.analyzing,
              transientCount: stem.transients.length,
              duration: stem.duration
            });

            // Force reactivity update by reassigning the stems array
            projectTree.stems = [...projectTree.stems];
            projectTree = { ...projectTree };

            // Update combined transients immediately
            updateCombinedTransients();

          } catch (error) {
            console.error(`❌ Error analyzing real audio for ${stem.name}:`, error);
            console.error(`❌ Error details:`, error.message);
            console.error(`❌ Error stack:`, error.stack);
            stem.transients = [];
            stem.duration = 0;
            stem.analyzing = false;
            // Force reactivity update even on error
            projectTree = { ...projectTree };
          } finally {
            stemDetectionInProgress.delete(stem.type);
          }

        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
        }
      }

      event.target.value = '';
      targetStemType = null;

      // Note: Removed auto-exclusion logic - let users control master/stem inclusion manually

      console.log('Final stems state after upload:', projectTree.stems.map(s => ({
        name: s.name,
        type: s.type,
        analyzing: s.analyzing,
        transientCount: s.transients?.length || 0
      })));

      // Force final reactivity update
      projectTree = { ...projectTree };

      // Debug: Check if stems are actually in the project tree
      console.log('🔍 DEBUG: projectTree.stems after processing:', projectTree.stems);
      console.log('🔍 DEBUG: projectTree.stems.length:', projectTree.stems.length);

      // Call callback for stems update
      onStemsUpdated?.({
        stems: projectTree.stems,
        visibleStems: projectTree.stems.filter(s => s.visible).map(s => s.id)
      });

      console.log('handleStemUpload completed successfully');

    } catch (error) {
      console.error('Error in handleStemUpload:', error);
      console.error('Error stack:', error.stack);
    }
  }

  // Track detection state to prevent multiple calls
  let masterDetectionInProgress = false;
  let stemDetectionInProgress = new Set();

  // Transient detection
  async function detectMasterTransients() {
    if (!projectTree.masterSong || !projectTree.masterSong.file) return;

    // Prevent multiple detections with stronger guard
    if (masterDetectionInProgress || projectTree.masterSong.analyzing || projectTree.masterSong.transients.length > 0) {
      console.log('🔄 Master transients already detected or analyzing, skipping...');
      return;
    }

    masterDetectionInProgress = true;

    try {
      projectTree.masterSong.analyzing = true;

      // Extract transients from the master audio file
      const result = await analyzeAudioForTransients(projectTree.masterSong.file, 'master');
      projectTree.masterSong.transients = result.transients;
      projectTree.masterSong.duration = result.duration;
      projectTree.masterSong.analyzing = false;

      console.log(`✅ Found ${result.transients.length} transients in master track`);

      // Force reactivity update
      projectTree = { ...projectTree };

      // Update combined transients to include master if not muted
      updateCombinedTransients();

    } catch (error) {
      console.error('❌ Failed to detect master transients:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      projectTree.masterSong.analyzing = false;
      projectTree.masterSong.transients = [];
      projectTree.masterSong.duration = 0;
      // Force reactivity update even on error
      projectTree = { ...projectTree };
    } finally {
      masterDetectionInProgress = false;
    }
  }



  // Transient detection using Web Audio API (based on AudioTimeline.svelte)
  async function analyzeAudioForTransients(file, stemType) {
    console.log(`🎵 Starting transient analysis for ${stemType}`);

    try {
      // Create audio context and decode the actual audio file
      const audioContext = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get the raw audio samples
      const rawData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;

      console.log(`📊 Audio data: ${rawData.length} samples, ${sampleRate}Hz, ${duration.toFixed(2)}s`);

      // Get stem-specific detection settings
      const settings = getStemDetectionSettings(stemType);

      // Transient detection parameters (based on AudioTimeline algorithm)
      const transients = [];
      const skipFactor = Math.max(1, Math.round((101 - settings.density) * 0.2));
      const randomThreshold = 1 - (settings.sensitivity / 100);
      const minSpacingSamples = Math.floor(settings.minSpacing * sampleRate);
      const windowSize = Math.floor(sampleRate * 0.01); // 10ms window

      let prevAvg = 0;
      let lastTransientSample = -minSpacingSamples;

      console.log(`🔧 Detection params for ${stemType}: density=${settings.density}, sensitivity=${settings.sensitivity}, minSpacing=${settings.minSpacing}s`);

      // Step through audio data looking for amplitude spikes (transients!)
      for (let i = 0; i < rawData.length; i += windowSize * skipFactor) {
        // Calculate RMS (Root Mean Square) for this window
        let sum = 0;
        for (let j = 0; j < windowSize; j++) {
          if (i + j < rawData.length) {
            sum += rawData[i + j] * rawData[i + j];
          }
        }
        const rms = Math.sqrt(sum / windowSize);

        // Detect sudden increase in amplitude (same logic as AudioTimeline)
        if (rms > prevAvg * (1 + randomThreshold) && rms > 0.01) {
          // Check minimum spacing to avoid duplicates
          if (i - lastTransientSample >= minSpacingSamples) {
            // Apply randomness factor (like AudioTimeline)
            if (Math.random() > 0.3) {
              const time = i / sampleRate;
              if (time > 0 && time < duration) {
                transients.push(time);
                lastTransientSample = i;
              }
            }
          }
        }
        prevAvg = (prevAvg + rms) / 2; // Smooth the comparison
      }

      console.log(`🎵 Detection complete: Found ${transients.length} transients in ${duration.toFixed(2)}s`);

      // Clean up
      audioContext.close();

      return { transients: transients.sort((a, b) => a - b), duration };

    } catch (error) {
      console.error(`❌ Failed to analyze audio:`, error);
      return { transients: [], duration: 0 }; // Return empty array on error
    }
  }







  // Master track controls
  function toggleMasterIncluded() {
    if (projectTree.masterSong) {
      projectTree.masterSong.included = !projectTree.masterSong.included;
      console.log(`🎵 Master track ${projectTree.masterSong.included ? 'included' : 'excluded'}`);
      updateCombinedTransients();
      // Force reactivity update
      projectTree = { ...projectTree };
    }
  }

  // Stem controls
  function toggleStemIncluded(stemId) {
    const stem = projectTree.stems.find(s => s.id === stemId);
    if (stem) {
      stem.included = !stem.included;
      console.log(`🎵 Stem ${stem.type} ${stem.included ? 'included' : 'excluded'}`);
      updateCombinedTransients();
      // Force reactivity update
      projectTree = { ...projectTree };
    }
  }



  function updateCombinedTransients() {
    // Combine all transients from included tracks (100% of analyzed transients)
    const combined = [];

    // Add master track transients if included
    if (projectTree.masterSong && projectTree.masterSong.transients && projectTree.masterSong.included) {
      projectTree.masterSong.transients.forEach(time => {
        combined.push({
          time,
          stem: 'master',
          color: '#00b8a9' // Master track color
        });
      });
    }

    // Add stem transients if included
    projectTree.stems.forEach(stem => {
      if (stem.visible && stem.transients && stem.included) {
        stem.transients.forEach(time => {
          combined.push({
            time,
            stem: stem.type,
            color: stem.color
          });
        });
      }
    });

    // Sort by time
    combined.sort((a, b) => a.time - b.time);

    const masterIncluded = projectTree.masterSong?.included && projectTree.masterSong.transients?.length > 0;
    const includedStems = projectTree.stems.filter(s => s.included && s.transients?.length > 0);

    console.log(`🎯 Combined transients: ${combined.length} total from ${includedStems.length} stems${masterIncluded ? ' + master' : ''}`);

    // Debug: Log the actual transient data being dispatched
    const transientData = combined.map(t => ({ time: t.time, color: t.color, source: t.stem }));
    console.log(`📤 Dispatching ${transientData.length} transients to AudioTimeline:`, transientData.slice(0, 3));

    // Call callback for ALL transient data to main timeline component for filtering
    onTransientsUpdated?.({
      transients: transientData,
      count: combined.length
    });

    // Also call callback for stem visibility updates
    const visibleStems = projectTree.stems.filter(s => s.visible && s.included);
    onStemsUpdated?.({
      stems: projectTree.stems,
      visibleStems: visibleStems.map(s => s.id)
    });
  }

  function downloadStem(stemId) {
    const stem = projectTree.stems.find(s => s.id === stemId);
    if (!stem) return;

    const link = document.createElement('a');
    link.href = stem.url;
    link.download = stem.name;
    link.click();
  }

  function selectMaster() {
    if (projectTree.masterSong) {
      onSelect?.(projectTree.masterSong);
    }
  }
</script>

<div class="audio-file-tree">
  <h3>Audio Files</h3>

  <!-- JSON Controls -->
  <div class="json-controls">
    <button class="json-btn save-btn" onclick={() => saveTransientsToJson(projectTree)}>
      💾 Save Transients
    </button>
    <button class="json-btn load-btn" onclick={() => jsonFileInput.click()}>
      📂 Load Transients
    </button>
  </div>

  <!-- Master Song Section -->
  <div class="tree-section">
    <div class="tree-header">
      <button class="expand-btn" onclick={() => toggleSection('master')}>
        <span class="expand-icon">{projectTree.expanded.master ? '▼' : '▶'}</span>
        <span class="section-title">Master ({projectTree.masterSong ? '1' : '0'})</span>
      </button>
      {#if !projectTree.masterSong}
        <button class="upload-btn" onclick={() => openMasterUpload()}>
          + Upload
        </button>
      {/if}
    </div>

    {#if projectTree.expanded.master}
      <div class="tree-content">
        {#if projectTree.masterSong}
          <div class="master-item-container">
            <button class="master-item active" onclick={() => selectMaster()}>
              <div class="file-info">
                <div class="file-name">{projectTree.masterSong.name}</div>
                <div class="file-meta">
                  {formatFileSize(projectTree.masterSong.size)}
                </div>
              </div>
              <div class="status-indicator">
                {#if projectTree.masterSong.analyzing}
                  <span class="analyzing">...</span>
                {:else}
                  <span class="ready">Ready</span>
                {/if}
              </div>
            </button>
            <div class="master-controls">
              <div class="track-controls">
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={projectTree.masterSong.included}
                    onchange={() => toggleMasterIncluded()}
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">Include</span>
                </label>



                <span class="transient-count">
                  {projectTree.masterSong.transients?.length || 0} transients
                </span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Stems Section -->
  <div class="tree-section">
    <div class="tree-header">
      <button class="expand-btn" onclick={() => toggleSection('stems')}>
        <span class="expand-icon">{projectTree.expanded.stems ? '▼' : '▶'}</span>
        <span class="section-title">Stems ({projectTree.stems.length})</span>
      </button>
      <button class="upload-btn" onclick={() => openStemUpload()}>
        + Add
      </button>
    </div>

    {#if projectTree.expanded.stems}
      <div class="tree-content">
        {#each stemTypes as stemType}
          {@const stem = projectTree.stems.find(s => s.type === stemType.id)}
          <div
            class="stem-slot"
            class:filled={stem}
            class:active={stem?.visible && !stem?.muted}
            style="border-left: 3px solid {stemType.color}; background-color: {stem ? stemType.bgColor : 'transparent'}"
          >
            <div class="stem-header">
              <div class="stem-identity">
                <span class="stem-dot" style="background-color: {stemType.color}"></span>
                <span class="stem-name">{stemType.name}</span>
              </div>

              {#if stem}
                <div class="stem-controls">
                  <label class="toggle-switch compact">
                    <input
                      type="checkbox"
                      checked={stem.included}
                      onchange={() => toggleStemIncluded(stem.id)}
                    />
                    <span class="toggle-slider"></span>
                  </label>

                  <span class="transient-count">
                    {stem.transients?.length || 0}
                  </span>

                  <button class="download-btn" onclick={() => downloadStem(stem.id)}>
                    ⬇
                  </button>
                </div>
              {:else}
                <button
                  class="add-stem-btn"
                  onclick={() => openStemUpload(stemType.id)}
                  style="color: {stemType.color}; border-color: {stemType.color}"
                >
                  + Add
                </button>
              {/if}
            </div>

            {#if stem}
              <!-- Simple transient timeline -->
              <div class="transient-timeline" style="background-color: {stemType.bgColor}">
                <div class="timeline-bar">
                  {#each stem.transients as transient}
                    <div
                      class="transient-marker"
                      style="left: {(transient / (stem.duration || 180)) * 100}%; background-color: {stemType.color};"
                      title="Transient at {transient.toFixed(2)}s"
                    ></div>
                  {/each}
                  <!-- Debug: Show transient count -->
                  {#if stem.transients?.length > 0}
                    <div style="position: absolute; top: -12px; left: 2px; font-size: 8px; color: {stemType.color}; background: rgba(0,0,0,0.7); padding: 1px 3px; border-radius: 2px;">
                      {stem.transients.length}
                    </div>
                  {/if}
                </div>

                {#if stem.analyzing}
                  <div class="analyzing-overlay">
                    <span>Analyzing...</span>
                  </div>
                {/if}
              </div>

              <!-- Compact stem info -->
              <div class="stem-info">
                <span class="file-name">{stem.name}</span>
                <span class="transient-count">{stem.transients?.length || 0} transients</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Hidden file inputs -->
<input bind:this={masterFileInput} type="file" accept="audio/*" style="display: none;" onchange={handleMasterUpload} />
<input bind:this={stemFileInput} type="file" accept="audio/*" multiple style="display: none;" onchange={handleStemUpload} />
<input bind:this={jsonFileInput} type="file" accept=".json" style="display: none;" onchange={handleJsonUpload} />

<style>
  .audio-file-tree {
    background-color: #121212;
    border-radius: 6px;
    padding: 15px;
    border: 1px solid #333;
    color: #e6e6e6;
  }

  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #00b8a9;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .json-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #333;
  }

  .json-btn {
    background-color: #2a2a2a;
    border: 1px solid #444;
    color: #e6e6e6;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
  }

  .json-btn:hover {
    background-color: #3a3a3a;
    border-color: #555;
  }

  .json-btn.save-btn:hover {
    background-color: rgba(0, 184, 169, 0.1);
    border-color: #00b8a9;
  }

  .json-btn.load-btn:hover {
    background-color: rgba(255, 193, 7, 0.1);
    border-color: #ffc107;
  }

  .tree-section {
    margin-bottom: 20px;
  }

  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background-color: #1a1a1a;
    border-radius: 4px;
    border: 1px solid #333;
  }

  .expand-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #e6e6e6;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
    flex: 1;
  }

  .expand-btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .expand-icon {
    font-size: 10px;
    color: #888;
    min-width: 10px;
  }

  .section-title {
    font-weight: 500;
    font-size: 13px;
  }

  .upload-btn {
    background-color: #00b8a9;
    color: #121212;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .upload-btn:hover {
    background-color: #00cebb;
    transform: translateY(-1px);
  }

  .tree-content {
    margin-left: 20px;
    padding-top: 8px;
  }

  .master-item-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .master-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background-color: #1a1a1a;
    border-radius: 6px;
    border: 1px solid #333;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
  }

  .master-item:hover {
    background-color: #222;
    border-color: #00b8a9;
  }

  .master-item.active {
    border-color: #00b8a9;
    background-color: rgba(0, 184, 169, 0.05);
  }

  .master-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 12px;
  }

  .file-info {
    flex: 1;
  }

  .file-name {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .file-meta {
    font-size: 10px;
    color: #888;
  }

  .status-indicator .analyzing {
    color: #ffc107;
    font-size: 10px;
  }

  .status-indicator .ready {
    color: #4caf50;
    font-size: 10px;
  }



  .stem-slot {
    margin-bottom: 12px;
    border-radius: 6px;
    overflow: hidden;
    transition: all 0.2s ease;
    background-color: #0f0f0f;
    border: 1px solid #222;
    opacity: 0.6;
  }

  .stem-slot.filled {
    background-color: #1a1a1a;
    border-color: #333;
    opacity: 1;
  }

  .stem-slot.active {
    border-right-color: #00b8a9;
    box-shadow: 0 0 0 1px rgba(0, 184, 169, 0.2);
  }

  .stem-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background-color: rgba(0, 0, 0, 0.2);
  }

  .stem-identity {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .stem-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .stem-name {
    font-weight: 500;
    font-size: 13px;
    color: #666;
  }

  .stem-slot.filled .stem-name {
    color: #e6e6e6;
  }



  .stem-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .track-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .toggle-switch {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: relative;
    width: 40px;
    height: 20px;
    background-color: #555;
    border-radius: 20px;
    transition: all 0.3s ease;
  }

  .toggle-slider:before {
    content: "";
    position: absolute;
    height: 16px;
    width: 16px;
    left: 2px;
    top: 2px;
    background-color: #e6e6e6;
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  .toggle-switch input:checked + .toggle-slider {
    background-color: #00b8a9;
  }

  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  .toggle-switch.compact .toggle-slider {
    width: 28px;
    height: 14px;
  }

  .toggle-switch.compact .toggle-slider:before {
    height: 10px;
    width: 10px;
    left: 2px;
    top: 2px;
  }

  .toggle-switch.compact input:checked + .toggle-slider:before {
    transform: translateX(14px);
  }

  .toggle-label {
    font-size: 11px;
    color: #e6e6e6;
    font-weight: 500;
  }



  .transient-count {
    font-size: 11px;
    color: #888;
    background-color: #333;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
  }

  .download-btn {
    background: none;
    border: 1px solid #555;
    color: #888;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .download-btn:hover {
    background-color: #333;
    color: #e6e6e6;
  }

  .add-stem-btn {
    background: none;
    border: 1px solid;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-stem-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .transient-timeline {
    height: 30px;
    position: relative;
    margin: 8px 16px;
    border-radius: 4px;
    overflow: hidden;
  }

  .timeline-bar {
    width: 100%;
    height: 100%;
    position: relative;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .transient-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    opacity: 0.8;
    transition: opacity 0.2s;
  }

  .transient-marker:hover {
    opacity: 1;
    width: 2px;
  }

  .analyzing-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #ffc107;
  }

  .stem-info {
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .stem-info .file-name {
    font-size: 12px;
    color: #e6e6e6;
    flex: 1;
    margin-right: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stem-info .transient-count {
    font-size: 10px;
    color: #888;
    background-color: #333;
    padding: 2px 6px;
    border-radius: 10px;
    white-space: nowrap;
  }
</style>
