<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // Props using Svelte 5 syntax
  let {
    currentVideo = null,
    playing = false,
    savedPositions = {},
    // getPreloadedVideo = null, // This was from the old 2-video system, can be removed if not used by WebGL version
    playbackRate = 1.0,
    filter = 'none' // Added filter prop
  } = $props();

  const dispatch = createEventDispatcher();

  let videoElement = $state(); // Single video element as the source
  let glCanvas = $state(); // Canvas for WebGL rendering
  let gl = $state(null); // WebGL context
  let shaderProgram = $state(null);
  let videoTexture = $state(null);
  let positionBuffer = $state(null);
  let texCoordBuffer = $state(null);
  
  let animationFrameId = $state(null);
  let currentVideoIdInternal = $state(null); // To track changes to currentVideo.id
  let videoReady = $state(false);
  let currentFilterName = $state('none');


  // Vertex shader (common for all filters)
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    varying highp vec2 vTextureCoord;
    void main(void) {
      gl_Position = aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  // Fragment shaders for different effects
  const fsSources = {
    none: `
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) {
        gl_FragColor = texture2D(uSampler, vTextureCoord);
      }
    `,
    invert: `
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) {
        vec4 textureColor = texture2D(uSampler, vTextureCoord);
        gl_FragColor = vec4(1.0 - textureColor.rgb, textureColor.a);
      }
    `,
    grayscale: `
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) {
        vec4 textureColor = texture2D(uSampler, vTextureCoord);
        float gray = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(vec3(gray), textureColor.a);
      }
    `
  };

  function initWebGL() {
    if (!glCanvas) return false;
    gl = glCanvas.getContext('webgl');
    if (!gl) {
      console.error('Unable to initialize WebGL. Your browser or machine may not support it.');
      dispatch('videoerror', { error: 'WebGL not supported', video: currentVideo });
      return false;
    }
    console.log('WebGL context initialized.');
    return true;
  }

  function initOrUpdateShaders(filterName) {
    if (!gl) return false;
    currentFilterName = filterName;
    const selectedFsSource = fsSources[filterName] || fsSources.none;

    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, selectedFsSource);

    if (!vertexShader || !fragmentShader) {
        console.error("Failed to load shaders.");
        return false;
    }

    const newShaderProgram = gl.createProgram();
    gl.attachShader(newShaderProgram, vertexShader);
    gl.attachShader(newShaderProgram, fragmentShader);
    gl.linkProgram(newShaderProgram);

    if (!gl.getProgramParameter(newShaderProgram, gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(newShaderProgram));
      // Clean up shaders if linking failed
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(newShaderProgram);
      return false;
    }

    // Delete old program if it exists
    if (shaderProgram) {
      // It's good practice to detach shaders, though deleting the program should handle it.
      // For simplicity here, directly delete. If issues arise, revisit shader detachment.
      gl.deleteProgram(shaderProgram);
    }
    
    shaderProgram = newShaderProgram;
    gl.useProgram(shaderProgram); // Important: use the new program
    console.log(`Shaders updated for filter: ${filterName}. Program linked and used.`);
    
    // Shaders can be deleted after linking to program
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return true;
  }

  function loadShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initBuffers() {
    // Vertex positions for a quad that fills the canvas
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Texture coordinates
    texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    // Flip Y for video texture
    const textureCoordinates = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
    console.log('WebGL buffers initialized.');
  }

  function initTexture() {
    videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    // Basic texture parameters - these might need adjustment
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Create a placeholder texture (e.g., 1x1 blue pixel) until video is ready
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    console.log('WebGL texture initialized.');
  }
  
  function updateTexture() {
    if (gl && videoTexture && videoElement && videoReady && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      // texImage2D with videoElement might cause warnings if video is not power-of-two or dimensions change.
      // For non-power-of-two, WebGL1 requires CLAMP_TO_EDGE and non-mipmap filters.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Correct orientation
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
    }
  }

  function renderLoop() {
    if (!gl || !shaderProgram) return;

    updateTexture();

    gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black
    gl.clear(gl.COLOR_BUFFER_BIT);

    const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    const textureCoordAttributeLocation = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    gl.enableVertexAttribArray(textureCoordAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(textureCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(shaderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uSampler'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationFrameId = requestAnimationFrame(renderLoop);
  }
  
  function setupWebGL() {
    if (!glCanvas) {
      console.error("Canvas element not found for WebGL setup.");
      return;
    }
    if (!initWebGL()) return;
    if (!initOrUpdateShaders(filter || 'none')) return; // Use current filter or 'none'
    initBuffers();
    initTexture();
    renderLoop(); // Start the render loop
    console.log("WebGL setup complete. Render loop started.");
  }

  $effect(() => {
    if (gl && filter && filter !== currentFilterName) {
      console.log(`Filter prop changed to: ${filter}. Updating shaders.`);
      initOrUpdateShaders(filter);
    }
  });
  
  $effect(() => {
    if (currentVideo && currentVideo.id !== currentVideoIdInternal) {
      loadVideo(currentVideo);
      currentVideoIdInternal = currentVideo.id;
    } else if (!currentVideo && videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoReady = false;
      currentVideoIdInternal = null;
    }
  });

  async function loadVideo(video) {
    if (!videoElement || !video || !video.url) return;
    console.log('🎬 Loading video:', video.name, 'URL:', video.url);
    videoReady = false;
    try {
      videoElement.src = video.url;
      videoElement.load(); // Important to call load()
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          videoElement.removeEventListener('canplay', onCanPlay);
          videoElement.removeEventListener('error', onError);
          videoReady = true;
          console.log('✅ Video ready to play (canplay event).');

          // Resize canvas to video aspect ratio
          if (glCanvas && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
            const containerWidth = glCanvas.parentElement.clientWidth;
            const containerHeight = glCanvas.parentElement.clientHeight;

            let canvasWidth = containerWidth;
            let canvasHeight = containerWidth / aspectRatio;

            if (canvasHeight > containerHeight) {
                canvasHeight = containerHeight;
                canvasWidth = containerHeight * aspectRatio;
            }
            glCanvas.width = canvasWidth;
            glCanvas.height = canvasHeight;
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            console.log(`Canvas resized to: ${glCanvas.width}x${glCanvas.height}`);
          }
          resolve();
        };
        const onError = (e) => {
          videoElement.removeEventListener('canplay', onCanPlay);
          videoElement.removeEventListener('error', onError);
          console.error('❌ Video load error:', e);
          dispatch('videoerror', { error: 'Video load error', video });
          reject(new Error('Video load error'));
        };
        videoElement.addEventListener('canplay', onCanPlay);
        videoElement.addEventListener('error', onError);
      });

      if (savedPositions[video.id] !== undefined) {
        videoElement.currentTime = savedPositions[video.id];
      } else {
        videoElement.currentTime = 0;
      }
      
      if (playing) {
        await videoElement.play().catch(e => console.warn("Autoplay possibly prevented:", e));
      }
    } catch (error) {
      console.error('❌ Error in loadVideo:', error);
      dispatch('videoerror', { error: error.message, video });
    }
  }

  $effect(() => {
    if (videoElement) {
      if (playing && videoReady) {
        videoElement.play().catch(e => console.warn("Playback error or interruption:", e));
      } else {
        videoElement.pause();
      }
    }
  });

  $effect(() => {
    if (videoElement) {
      videoElement.playbackRate = playbackRate;
    }
  });

  export function setPlaybackRate(rate) {
    if (videoElement) {
      videoElement.playbackRate = rate;
    }
  }

  export function getCurrentTime() {
    return videoElement ? videoElement.currentTime : null;
  }

  onMount(() => {
    // Ensure videoElement is bound before setup
    // The $effect for currentVideo will handle initial load
    // Setup WebGL after a short delay to ensure canvas is in DOM
    setTimeout(setupWebGL, 0);
  });

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (videoElement) {
      videoElement.pause();
      videoElement.src = ''; // Release resources
    }
    // TODO: Clean up WebGL resources (buffers, textures, shaders, program)
    if (gl) {
        if (videoTexture) gl.deleteTexture(videoTexture);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (texCoordBuffer) gl.deleteBuffer(texCoordBuffer);
        if (shaderProgram) {
            // Detach and delete shaders if they are stored
            // gl.deleteProgram(shaderProgram);
        }
        console.log("WebGL resources cleaned up (partially).");
    }
  });

</script>

<div class="video-player">
  {#if currentVideo}
    <canvas bind:this={glCanvas} class="webgl-canvas"></canvas>
    <!-- Hidden video element as source for WebGL texture -->
    <video
      bind:this={videoElement}
      style="display: none;"
      muted
      loop
      preload="auto"
      crossorigin="anonymous"
      playsinline
      on:loadedmetadata={() => {
        console.log("Video metadata loaded:", videoElement.videoWidth, videoElement.videoHeight);
      }}
      on:playing={() => console.log("Video is playing (event)")}
      on:pause={() => console.log("Video is paused (event)")}
      on:ended={() => console.log("Video ended (event)")}
      on:error={(e) => {
        console.error("Video element error:", e);
        dispatch('videoerror', { error: 'Video element error', video: currentVideo });
      }}
    >
      <track kind="captions" src="" label="No captions available" default />
    </video>
  {:else}
    <div class="no-video">No video selected</div>
  {/if}
</div>

<style>
  .video-player {
    width: 100%;
    height: 100%;
    background-color: #121212;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  .composite-canvas {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background-color: #121212;
    display: block;
  }
  
  .hidden-videos {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  
  .hidden-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    top: 0;
    left: 0;
    /* transition: opacity 0.1s ease; */ /* Disabled for instant switching */
  }
  
  .hidden-video.active {
    opacity: 1;
    z-index: 2;
  }
  
  .hidden-video.inactive {
    opacity: 0;
    z-index: 1;
  }
  
  .composite-canvas {
    z-index: 3;
    display: none; /* Hidden for debugging */
  }
  
  .no-video {
    color: #666;
    font-size: 18px;
    z-index: 3;
  }
</style>
