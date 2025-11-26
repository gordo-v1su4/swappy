<script>
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { VideoCodecsDecoder, VideoTextureManager } from '../../lib/video/video-codecs.js';

	// Props
	export let file = null; // Video file to play
	export let fragmentShader = null; // Fragment shader
	export let uniforms = {}; // Shader uniforms
	export let audioReactive = false; // Enable audio reactivity
	export let audioAnalyzer = null; // Audio analyzer instance
	export let width = '100%';
	export let height = '100%';

	// Refs
	let container;
	let canvas;
	let renderer;
	let scene;
	let camera;
	let material;
	let videoDecoder;
	let textureManager;
	let videoTexture;
	let animationId;
	let isPlaying = false;
	let isReady = false;
	let frameQueue = [];
	let frameIndex = 0;
	let videoStartTime = 0;
	let currentPlaybackTime = 0;
	
	// Video info
	let videoInfo = null;
	const FRAME_DURATION_MS = 1000 / 24; // Target 24fps

	// Audio data for reactivity
	let audioData = {
		audioLevel: 0,
		bassLevel: 0,
		midLevel: 0,
		trebleLevel: 0,
		beat: false,
		onset: false
	};

	onMount(() => {
		if (!file) return;
		
		initThreeJS();
		initVideoDecoder();
		
		return () => {
			cleanup();
		};
	});

	async function initThreeJS() {
		const containerRect = container.getBoundingClientRect();
		const renderWidth = containerRect.width || 640;
		const renderHeight = containerRect.height || 360;

		// Create renderer
		renderer = new THREE.WebGLRenderer({ 
			canvas: canvas, 
			antialias: true,
			alpha: true
		});
		renderer.setSize(renderWidth, renderHeight);
		renderer.setPixelRatio(window.devicePixelRatio);

		// Create scene and camera
		scene = new THREE.Scene();
		camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

		// Create video texture manager
		textureManager = new VideoTextureManager(renderer.getContext());
		videoTexture = textureManager.createVideoTexture();

		// Create shader material
		createShaderMaterial();

		// Create fullscreen quad
		const geometry = new THREE.PlaneGeometry(2, 2);
		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		// Start render loop
		renderLoop();
	}

	function createShaderMaterial() {
		const vertexShader = `
			varying vec2 v_uv;
			void main() {
				v_uv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`;

		// Parse uniforms and add video texture
		const uniformValues = {
			u_texture: { value: videoTexture },
			u_resolution: { 
				value: [canvas.width || 640, canvas.height || 360] 
			},
			u_time: { value: 0.0 },
			...uniforms
		};

		material = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			uniforms: uniformValues,
			transparent: false
		});
	}

	async function initVideoDecoder() {
		videoDecoder = new VideoCodecsDecoder();
		
		videoDecoder.onReady = (info) => {
			videoInfo = info;
			isReady = true;
			console.log('Video ready:', info);
		};

		videoDecoder.onFrame = (frame) => {
			frameQueue.push(frame);
		};

		const success = await videoDecoder.initialize(file);
		if (success) {
			console.log('Video decoder initialized successfully');
		}
	}

	function renderLoop() {
		if (!isPlaying || !isReady) {
			animationId = requestAnimationFrame(renderLoop);
			return;
		}

		// Update time uniform
		if (material && material.uniforms.u_time) {
			material.uniforms.u_time.value = (performance.now() - videoStartTime) / 1000;
		}

		// Update audio reactivity
		if (audioReactive && audioAnalyzer) {
			updateAudioReactivity();
		}

		// Get next frame if available
		const targetFrameTime = frameIndex * FRAME_DURATION_MS;
		const currentTime = performance.now() - videoStartTime;

		if (currentTime >= targetFrameTime && frameQueue.length > 0) {
			const frame = videoDecoder.getNextFrame();
			if (frame) {
				// Update video texture
				textureManager.uploadVideoFrame(frame, videoTexture);
				// Close the frame after upload
				frame.close();
				frameIndex++;
			}
		}

		// Render
		if (renderer && scene && camera) {
			renderer.render(scene, camera);
		}

		animationId = requestAnimationFrame(renderLoop);
	}

	function updateAudioReactivity() {
		const data = audioAnalyzer.getAudioData();
		if (data) {
			audioData = { ...data };
			
			// Update shader uniforms with audio data
			if (material && material.uniforms) {
				if (material.uniforms.u_audioLevel !== undefined) {
					material.uniforms.u_audioLevel.value = data.audioLevel;
				}
				if (material.uniforms.u_bassLevel !== undefined) {
					material.uniforms.u_bassLevel.value = data.bassLevel;
				}
				if (material.uniforms.u_midLevel !== undefined) {
					material.uniforms.u_midLevel.value = data.midLevel * 2; // Boost mids
				}
				if (material.uniforms.u_trebleLevel !== undefined) {
					material.uniforms.u_trebleLevel.value = data.trebleLevel * 1.5; // Boost treble
				}
			}
		}
	}

	export function start() {
		if (!isReady) return;
		
		isPlaying = true;
		videoStartTime = performance.now();
		frameIndex = 0;
		
		// Clear frame queue and start decoding
		frameQueue = [];
		if (videoDecoder) {
			videoDecoder.startDecoding();
		}
	}

	export function pause() {
		isPlaying = false;
		currentPlaybackTime = performance.now();
	}

	export function stop() {
		isPlaying = false;
		frameIndex = 0;
		videoStartTime = 0;
		currentPlaybackTime = 0;
		
		// Clear frame queue
		frameQueue = [];
	}

	export function play() {
		if (!isPlaying) {
			start();
		}
	}

	function cleanup() {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		
		if (videoDecoder) {
			videoDecoder.destroy();
		}
		
		if (textureManager) {
			textureManager.destroy();
		}
		
		if (renderer) {
			renderer.dispose();
		}
		
		if (material) {
			material.dispose();
		}
	}

	function handleResize() {
		if (!container || !renderer) return;
		
		const rect = container.getBoundingClientRect();
		renderer.setSize(rect.width, rect.height);
		
		if (material && material.uniforms.u_resolution) {
			material.uniforms.u_resolution.value = [rect.width, rect.height];
		}
	}

	// Handle file changes
	$: if (file && renderer) {
		// Restart with new file
		stop();
		cleanup();
		initThreeJS();
		initVideoDecoder();
	}
	
	// Handle shader changes
	$: if (fragmentShader && renderer) {
		createShaderMaterial();
	}
</script>

<svelte:window on:resize={handleResize} />

<div 
	class="shader-video-player" 
	bind:this={container}
	style="width: {width}; height: {height}; position: relative;"
>
	<canvas bind:this={canvas} style="display: block; width: 100%; height: 100%;"></canvas>
	
	{#if !isReady}
		<div class="loading-overlay">
			<div class="loading-content">
				<div class="spinner"></div>
				<p>Initializing video...</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.shader-video-player {
		background: #000;
		border-radius: 8px;
		overflow: hidden;
	}
	
	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.8);
		color: #fff;
	}
	
	.loading-content {
		text-align: center;
	}
	
	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #333;
		border-top: 4px solid #00b8a9;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}
	
	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style>
