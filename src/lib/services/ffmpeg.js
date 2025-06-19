import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  constructor() {
    this.ffmpeg = null;
    this.isLoaded = false;
    this.isLoading = false;
  }

  async load() {
    if (this.isLoaded) return;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    try {
      this.isLoading = true;
      this.ffmpeg = new FFmpeg();

      // Load FFmpeg core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });

      this.isLoaded = true;
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async splitStems(audioFile) {
    await this.load();

    try {
      // Write input file
      const inputData = await fetchFile(audioFile);
      await this.ffmpeg.writeFile('input.mp3', inputData);

      // Split into stems using Spleeter-like approach
      // Note: This is a simplified version, real stem separation would require a trained model
      await this.ffmpeg.exec([
        '-i', 'input.mp3',
        '-filter_complex',
        '[0:a]highpass=f=200[vocals];[0:a]lowpass=f=200[instrumental]',
        '-map', '[vocals]', 'vocals.wav',
        '-map', '[instrumental]', 'instrumental.wav'
      ]);

      // Read output files
      const vocalsData = await this.ffmpeg.readFile('vocals.wav');
      const instrumentalData = await this.ffmpeg.readFile('instrumental.wav');

      // Clean up
      await this.ffmpeg.deleteFile('input.mp3');
      await this.ffmpeg.deleteFile('vocals.wav');
      await this.ffmpeg.deleteFile('instrumental.wav');

      return {
        vocals: new Blob([vocalsData], { type: 'audio/wav' }),
        instrumental: new Blob([instrumentalData], { type: 'audio/wav' })
      };
    } catch (error) {
      console.error('Error splitting stems:', error);
      throw error;
    }
  }

  async detectBPM(audioFile) {
    await this.load();

    try {
      // Write input file
      const inputData = await fetchFile(audioFile);
      await this.ffmpeg.writeFile('input.mp3', inputData);

      // Use FFmpeg's ebur128 filter to analyze loudness
      await this.ffmpeg.exec([
        '-i', 'input.mp3',
        '-filter:a', 'ebur128',
        '-f', 'null',
        '-'
      ]);

      // Clean up
      await this.ffmpeg.deleteFile('input.mp3');

      // Parse FFmpeg output for BPM
      // Note: This is a placeholder. Real BPM detection would require more sophisticated analysis
      return 120;
    } catch (error) {
      console.error('Error detecting BPM:', error);
      throw error;
    }
  }

  destroy() {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }
}

export const ffmpegService = new FFmpegService(); 