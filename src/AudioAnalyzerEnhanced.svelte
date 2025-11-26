<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	
	const dispatch = createEventDispatcher();
	
	// Props
	export let audioUrl = null;
	export let fftSize = 2048; // Higher resolution for better analysis
	export let smoothingTimeConstant = 0.8; // Smoothing between frames
	
	// Internal state
	let audioContext = null;
	let analyser = null;
	let audioElement = null;
	let sourceNode = null;
	let dataArray = null;
	let isInitialized = false;
	let isPlaying = false;
	let animationId = null;
	
	// Audio analysis data
	let audioData = {
		audioLevel: 0,
		bassLevel: 0,
		midLevel: 0,
		trebleLevel: 0,
		bassHistory: [],
		midHistory: [],
		trebleHistory: [],
		maxHistoryLength: 10, // Keep last 10 frames for trend analysis
		onsetDetected: false,
		beatDetected: false,
		bpm: 0,
		beatCount: 0,
		lastBeatTime: 0,
		beatInterval: 0
	};
	
	// Frequency ranges for different analysis types
	const frequencyRanges = {
		subBass: [20, 60],    // 20-60 Hz
		bass: [60, 250],      // 60-250 Hz
		lowMid: [250, 500],   // 250-500 Hz
		mid: [500, 2000],     // 500-2000 Hz
		highMid: [2000, 6000], // 2-6 kHz
		treble: [6000, 20000] // 6-20 kHz
	};
	
	// Onset detection variables
	let onsetThreshold = 0.1;
	let onsetThresholdMultiplier = 1.5;
	let onsetCooloff = 0;
	let onsetCooloffMax = 5; // Frames (can be adjusted)
	
	// Beat detection variables
	let beatThreshold = 0.15; // Minimum bass level for beat detection
	let beatCooloff = 0;
	let beatCooloffMax = 15; // Approx 250ms at 60fps
	let beatTimes = []; // Store recent beat timestamps for BPM calculation
	let maxBeatTimes = 8; // Use last 8 beats for BPM calculation
	
	onMount(() => {
		if (audioUrl) {
			initializeAudio();
		}
		
		return () => {
			cleanup();
		};
	});
	
	async function initializeAudio() {
		try {
			// Create audio context
			audioContext = new (window.AudioContext || window.webkitAudioContext)();
			
			// Create audio element
			audioElement = new Audio();
			audioElement.crossOrigin = "anonymous";
			audioElement.src = audioUrl;
			
			// Wait for metadata to load
			await new Promise((resolve) => {
				audioElement.addEventListener('loadedmetadata', resolve, { once: true });
			});
			
			// Create analyser
			analyser = audioContext.createAnalyser();
			analyser.fftSize = fftSize;
			analyser.smoothingTimeConstant = smoothingTimeConstant;
			
			dataArray = new Uint8Array(analyser.frequencyBinCount);
			
			// Connect audio nodes
			sourceNode = audioContext.createMediaElementSource(audioElement);
			sourceNode.connect(analyser);
			analyser.connect(audioContext.destination);
			
			isInitialized = true;
			dispatch('initialized', { duration: audioElement.duration });
			
			// Start analysis loop
			startAnalysis();
			
		} catch (error) {
			console.error('Failed to initialize audio analyzer:', error);
			dispatch('error', { error });
		}
	}
	
	function startAnalysis() {
		if (!isInitialized) return;
		
		function analyze() {
			if (!analyser || !dataArray) return;
			
			// Get frequency data
			analyser.getByteFrequencyData(dataArray);
			
			// Calculate frequency band levels
			const levels = calculateFrequencyLevels();
			
			// Detect onsets (transients/sudden changes)
			const onset = detectOnset(levels);
			
			// Detect beats (rhythmic bass hits)
			const beat = detectBeat(levels);
			
			// Calculate BPM
			if (beat) {
				calculateBPM();
			}
			
			// Update audio data
			audioData = {
				...audioData,
				...levels,
				onsetDetected: onset,
				beatDetected: beat,
				bassHistory: updateHistory(audioData.bassHistory, levels.bassLevel),
				midHistory: updateHistory(audioData.midHistory, levels.midLevel),
				trebleHistory: updateHistory(audioData.trebleHistory, levels.trebleLevel)
			};
			
			// Dispatch audio analysis event
			dispatch('audioanalyzed', { 
				data: audioData,
				currentTime: audioElement ? audioElement.currentTime : 0
			});
			
			// Count down cooloff timers
			if (onsetCooloff > 0) onsetCooloff--;
			if (beatCooloff > 0) beatCooloff--;
			
			animationId = requestAnimationFrame(analyze);
		}
		
		analyze();
	}
	
	function calculateFrequencyLevels() {
		const nyquist = audioContext.sampleRate / 2;
		const binCount = analyser.frequencyBinCount;
		
		// Calculate overall audio level
		const audioLevel = dataArray.reduce((sum, value) => sum + value, 0) / (binCount * 255);
		
		// Calculate band levels
		const getBandLevel = (startFreq, endFreq) => {
			const startBin = Math.floor((startFreq / nyquist) * binCount);
			const endBin = Math.floor((endFreq / nyquist) * binCount);
			
			let sum = 0;
			let count = 0;
			
			for (let i = startBin; i < endBin && i < dataArray.length; i++) {
				sum += dataArray[i];
				count++;
			}
			
			return count > 0 ? (sum / count) / 255 : 0;
		};
		
		// Enhanced frequency analysis with better ranges
		const bassRange = frequencyRanges.bass; // 60-250 Hz
		const midRange = frequencyRanges.mid;   // 500-2000 Hz  
		const trebleRange = frequencyRanges.treble; // 6k-20k Hz
		
		// Also calculate sub-bass for more intense bass response
		const subBassLevel = getBandLevel(...frequencyRanges.subBass);
		const bassLevel = getBandLevel(...bassRange) + subBassLevel * 0.5; // Boost bass with sub-bass
		const midLevel = getBandLevel(...midRange);
		const trebleLevel = getBandLevel(...trebleRange);
		
		return {
			audioLevel: Math.pow(audioLevel, 0.5), // Square root for more natural response
			bassLevel: Math.pow(bassLevel, 0.7),    // Bass enhancement
			midLevel: Math.pow(midLevel, 0.8),
			trebleLevel: Math.pow(trebleLevel, 0.6)  // Treble enhancement
		};
	}
	
	function detectOnset(levels) {
		if (onsetCooloff > 0) return false;
		
		// Simple onset detection using spectral flux
		if (audioData.midHistory.length < 2) return false;
		
		// Calculate energy change in mid frequencies (for vocal/transient detection)
		const prevEnergy = audioData.midHistory[audioData.midHistory.length - 1];
		const currentEnergy = levels.midLevel;
		
		// Check for significant positive change
		const energyChange = currentEnergy - prevEnergy;
		const threshold = onsetThreshold * onsetThresholdMultiplier;
		
		if (energyChange > threshold && levels.audioLevel > 0.1) {
			onsetCooloff = onsetCooloffMax;
			return true;
		}
		
		return false;
	}
	
	function detectBeat(levels) {
		if (beatCooloff > 0) return false;
		
		// Beat detection focused on bass frequencies
		const bassLevel = levels.bassLevel;
		const avgBassLevel = audioData.bassHistory.length > 0 
			? audioData.bassHistory.reduce((a, b) => a + b) / audioData.bassHistory.length 
			: 0;
		
		// Detect beat when bass is significantly above average
		if (bassLevel > avgBassLevel * 1.3 && bassLevel > beatThreshold) {
			beatCooloff = beatCooloffMax;
			
			// Record beat time for BPM calculation
			const now = performance.now();
			beatTimes.push(now);
			
			// Keep only recent beats
			if (beatTimes.length > maxBeatTimes) {
				beatTimes.shift();
			}
			
			return true;
		}
		
		return false;
	}
	
	function calculateBPM() {
		if (beatTimes.length < 4) return; // Need at least 4 beats
		
		// Calculate intervals between beats
		const intervals = [];
		for (let i = 1; i < beatTimes.length; i++) {
			intervals.push(beatTimes[i] - beatTimes[i - 1]);
		}
		
		// Average the intervals
		const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
		
		// Convert to BPM (beats per minute)
		const bpm = Math.round(60000 / avgInterval);
		
		// Only update if BPM is in reasonable range (60-180 BPM)
		if (bpm >= 60 && bpm <= 180) {
			audioData.bpm = bpm;
			audioData.beatInterval = avgInterval;
		}
	}
	
	function updateHistory(history, newValue) {
		history.push(newValue);
		if (history.length > audioData.maxHistoryLength) {
			history.shift();
		}
		return history;
	}
	
	// Playback controls
	export function play() {
		if (!audioElement || !isInitialized) return;
		
		// Resume audio context if suspended
		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}
		
		audioElement.play();
		isPlaying = true;
	}
	
	export function pause() {
		if (!audioElement) return;
		
		audioElement.pause();
		isPlaying = false;
	}
	
	export function stop() {
		if (!audioElement) return;
		
		audioElement.pause();
		audioElement.currentTime = 0;
		isPlaying = false;
		
		// Reset analysis
		resetAnalysis();
	}
	
	export function seek(time) {
		if (!audioElement) return;
		
		audioElement.currentTime = time;
		resetAnalysis(); // Reset after seek
	}
	
	function resetAnalysis() {
		// Clear histories and beat detection
		audioData.bassHistory = [];
		audioData.midHistory = [];
		audioData.trebleHistory = [];
		audioData.onsetDetected = false;
		audioData.beatDetected = false;
		beatTimes = [];
		onsetCooloff = 0;
		beatCooloff = 0;
	}
	
	function cleanup() {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		
		if (audioContext) {
			audioContext.close();
		}
		
		if (audioElement) {
			audioElement.pause();
			if (audioElement.src) {
				URL.revokeObjectURL(audioElement.src);
			}
		}
		
		if (sourceNode) {
			sourceNode.disconnect();
		}
		
		if (analyser) {
			analyser.disconnect();
		}
	}
	
	// Reactive updates
	$: if (audioUrl && !isInitialized) {
		initializeAudio();
	}
</script>

<svelte:options accessors />

{#if !isInitialized}
	<div class="analyzer-loading">
		Initializing audio analyzer...
	</div>
{/if}

<style>
	.analyzer-loading {
		padding: 1rem;
		text-align: center;
		color: #888;
	}
</style>

<!-- Usage example:
<AudioAnalyzerEnhanced
	bind:this={audioAnalyzer}
	audioUrl={selectedAudioUrl}
	on:audioanalyzed={(e) => handleAudioAnalysis(e.detail)}
	on:initialized={(e) => console.log('Audio ready', e.detail)}
/>
-->
