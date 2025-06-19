import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
    this.loading = false;

    // Set up logging
    this.ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    this.ffmpeg.on('progress', ({ progress }) => {
      console.log('FFmpeg progress:', Math.round(progress * 100) + '%');
    });
  }

  async load() {
    if (this.loaded) return;
    if (this.loading) {
      // Wait for existing load to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.loading = true;

    try {
      console.log('🔄 Loading FFmpeg WASM...');

      // Try different loading strategies
      const loadStrategies = [
        // Strategy 1: Default load
        async () => {
          console.log('🔄 Trying default FFmpeg load...');
          await this.ffmpeg.load();
        },
        // Strategy 2: JSDelivr CDN
        async () => {
          console.log('🔄 Trying JSDelivr CDN...');
          const coreURL = await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.15/dist/umd/ffmpeg-core.js', 'text/javascript');
          const wasmURL = await toBlobURL('https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.15/dist/umd/ffmpeg-core.wasm', 'application/wasm');
          await this.ffmpeg.load({ coreURL, wasmURL });
        },
        // Strategy 3: UNPKG CDN
        async () => {
          console.log('🔄 Trying UNPKG CDN...');
          const coreURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.15/dist/umd/ffmpeg-core.js', 'text/javascript');
          const wasmURL = await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.15/dist/umd/ffmpeg-core.wasm', 'application/wasm');
          await this.ffmpeg.load({ coreURL, wasmURL });
        }
      ];

      let loadSuccess = false;
      let lastError = null;

      for (let i = 0; i < loadStrategies.length; i++) {
        try {
          await loadStrategies[i]();
          loadSuccess = true;
          console.log(`✅ FFmpeg loaded successfully with strategy ${i + 1}`);
          break;
        } catch (error) {
          console.warn(`⚠️ Strategy ${i + 1} failed:`, error.message);
          lastError = error;
          continue;
        }
      }

      if (!loadSuccess) {
        throw lastError || new Error('All FFmpeg loading options failed');
      }

      this.loaded = true;
    } catch (error) {
      console.error('❌ Failed to load FFmpeg:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generateThumbnail(videoFile, timeSeconds = 1) {
    await this.load();
    // Generate a unique id for this operation
    const uniqueId = `thumb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const inputFileName = `input-${uniqueId}.mp4`;
    const outputFileName = `thumbnail-${uniqueId}.jpg`;
    try {
      // Write video file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
      // Generate thumbnail at specified time with proper single image output
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-ss', timeSeconds.toString(),
        '-vframes', '1',
        '-vf', 'scale=320:-1',
        '-q:v', '2',
        '-update', '1',  // Force overwrite output file for single image
        '-y',            // Overwrite output file without asking
        outputFileName
      ]);
      // Read the generated thumbnail
      const data = await this.ffmpeg.readFile(outputFileName);
      // Clean up
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);
      // Create blob URL from the thumbnail data
      const blob = new Blob([data.buffer], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch (error) {
      // Attempt cleanup on error as well
      try {
        await this.ffmpeg.deleteFile(inputFileName);
      } catch {}
      try {
        await this.ffmpeg.deleteFile(outputFileName);
      } catch {}
      console.error('Error generating thumbnail:', error);
      throw error;
    }
  }

  async getVideoInfo(videoFile) {
    await this.load();
    
    try {
      const inputFileName = 'input.mp4';
      
      // Write video file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
      
      // Get video information
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-f', 'null', '-'
      ]);
      
      // Clean up
      await this.ffmpeg.deleteFile(inputFileName);
      
      // Note: In a real implementation, you'd parse the FFmpeg output
      // to extract duration, resolution, etc. For now, we'll return basic info
      return {
        duration: 0, // Would be parsed from FFmpeg output
        width: 0,
        height: 0
      };
      
    } catch (error) {
      console.error('Error getting video info:', error);
      throw error;
    }
  }

  async extractAudio(videoFile) {
    await this.load();
    const uniqueId = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const inputFileName = `input-${uniqueId}.mp4`;
    const outputFileName = `audio-${uniqueId}.wav`;
    try {
      // Write video file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
      // Extract audio
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputFileName
      ]);
      // Read the extracted audio
      const data = await this.ffmpeg.readFile(outputFileName);
      // Clean up
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);
      // Create blob URL from the audio data
      const blob = new Blob([data.buffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (error) {
      try { await this.ffmpeg.deleteFile(inputFileName); } catch {}
      try { await this.ffmpeg.deleteFile(outputFileName); } catch {}
      console.error('Error extracting audio:', error);
      throw error;
    }
  }

  async convertVideo(videoFile, options = {}) {
    await this.load();
    const uniqueId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const inputFileName = `input-${uniqueId}.mp4`;
    const outputFileName = `output-${uniqueId}.mp4`;
    try {
      // Write video file to FFmpeg filesystem
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
      // Build FFmpeg command based on options
      const command = ['-i', inputFileName];
      if (options.scale) {
        command.push('-vf', `scale=${options.scale}`);
      }
      if (options.fps) {
        command.push('-r', options.fps.toString());
      }
      if (options.quality) {
        command.push('-crf', options.quality.toString());
      }
      command.push(outputFileName);
      // Execute conversion
      await this.ffmpeg.exec(command);
      // Read the converted video
      const data = await this.ffmpeg.readFile(outputFileName);
      // Clean up
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile(outputFileName);
      // Create blob URL from the converted video
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      return URL.createObjectURL(blob);
    } catch (error) {
      try { await this.ffmpeg.deleteFile(inputFileName); } catch {}
      try { await this.ffmpeg.deleteFile(outputFileName); } catch {}
      console.error('Error converting video:', error);
      throw error;
    }
  }

  // Set up progress callback for long operations
  setProgressCallback(callback) {
    this.ffmpeg.on('progress', callback);
  }

  // Set up log callback for debugging
  setLogCallback(callback) {
    this.ffmpeg.on('log', callback);
  }

}

// Create a singleton instance
const ffmpegService = new FFmpegService();

export default ffmpegService;
