import { ffmpegService } from './ffmpeg';

class AudioService {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
    this.beatPositions = [];
    this.isProcessing = false;
    this.currentFile = null;
    this.onAudioLoaded = null;
  }

  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  async loadAudio(file) {
    await this.initialize();
    this.currentFile = file;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      if (this.onAudioLoaded) {
        this.onAudioLoaded(file);
      }

      return {
        duration: this.audioBuffer.duration,
        sampleRate: this.audioBuffer.sampleRate,
        numberOfChannels: this.audioBuffer.numberOfChannels,
        arrayBuffer
      };
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  async detectBeats(threshold = 0.75, energyThreshold = 0.5) {
    if (!this.audioBuffer) throw new Error("Audio not loaded");

    this.isProcessing = true;
    try {
      const data = this.audioBuffer.getChannelData(0);
      const sampleRate = this.audioBuffer.sampleRate;
      const samplesPerBeat = Math.floor(sampleRate * 0.1);
      
      const energyMap = new Float32Array(Math.ceil(data.length / samplesPerBeat));
      for (let i = 0; i < data.length; i += samplesPerBeat) {
        let sum = 0;
        for (let j = 0; j < samplesPerBeat && (i + j) < data.length; j++) {
          sum += data[i + j] * data[i + j];
        }
        energyMap[Math.floor(i / samplesPerBeat)] = Math.sqrt(sum / samplesPerBeat);
      }

      const newBeatPositions = [];
      const windowSize = Math.floor(0.1 * sampleRate / samplesPerBeat);
      
      for (let i = windowSize; i < energyMap.length - windowSize; i++) {
        const localEnergy = energyMap[i];
        let isLocalMax = true;
        
        for (let j = i - windowSize; j <= i + windowSize; j++) {
          if (j !== i && energyMap[j] >= localEnergy) {
            isLocalMax = false;
            break;
          }
        }

        if (isLocalMax && 
            localEnergy > threshold && 
            localEnergy > energyThreshold * Math.max(...energyMap)) {
          newBeatPositions.push((i * samplesPerBeat) / sampleRate);
        }
      }
      this.beatPositions = newBeatPositions;

      const bpm = await ffmpegService.detectBPM(this.currentFile);
      console.log('Detected BPM:', bpm);

      return this.beatPositions;
    } finally {
      this.isProcessing = false;
    }
  }

  async splitStems() {
    if (!this.currentFile) {
      throw new Error('No audio file loaded');
    }
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
        const stems = await ffmpegService.splitStems(this.currentFile);
        return stems;
    } finally {
        this.isProcessing = false;
    }
  }

  destroy() {
    if (this.audioContext) {
      this.audioContext.close();
    }
    ffmpegService.destroy();
  }
}

export const audioService = new AudioService(); 