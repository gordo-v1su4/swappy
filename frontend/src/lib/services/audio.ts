import { ffmpeg } from './ffmpeg';

class TransientDetector {
  private bufferSize = 2048;
  private energyHistory: number[] = [];
  private historyLength = 10;
  private threshold = 0.15;
  private minTimeBetweenTransients = 0.05; // 50ms minimum between transients
  private lastTransientTime = 0;

  constructor(threshold = 0.15) {
    this.threshold = threshold;
  }

  detectTransients(audioData: Float32Array, sampleRate: number): number[] {
    const transients: number[] = [];
    const frameEnergy = this.calculateFrameEnergy(audioData);
    
    // Add to history
    this.energyHistory.push(frameEnergy);
    if (this.energyHistory.length > this.historyLength) {
      this.energyHistory.shift();
    }

    // Need enough history to detect transients
    if (this.energyHistory.length < this.historyLength) {
      return transients;
    }

    // Calculate average energy of recent frames
    const recentAverage = this.energyHistory
      .slice(0, -1)
      .reduce((sum, energy) => sum + energy, 0) / (this.historyLength - 1);

    // Current frame energy
    const currentEnergy = this.energyHistory[this.energyHistory.length - 1];

    // Calculate time since last transient
    const currentTime = audioData.length / sampleRate;
    const timeSinceLastTransient = currentTime - this.lastTransientTime;

    // Detect sudden energy increase (transient)
    if (currentEnergy > recentAverage * (1 + this.threshold) && 
        timeSinceLastTransient >= this.minTimeBetweenTransients) {
      transients.push(currentTime);
      this.lastTransientTime = currentTime;
    }

    return transients;
  }

  private calculateFrameEnergy(frame: Float32Array): number {
    return frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length;
  }

  setThreshold(newThreshold: number) {
    this.threshold = Math.max(0.01, Math.min(1, newThreshold));
  }
}

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private transientDetector: TransientDetector;
  private onTransientCallback: ((time: number) => void) | null = null;

  constructor() {
    this.initAudioContext();
    this.transientDetector = new TransientDetector();
  }

  private initAudioContext() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyserNode = this.audioContext.createAnalyser();
    this.gainNode = this.audioContext.createGain();
    
    // Configure analyser for high-resolution frequency analysis
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.2; // Lower for better transient response
    
    // Create script processor for real-time analysis
    this.scriptNode = this.audioContext.createScriptProcessor(2048, 1, 1);
    
    // Connect nodes
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
    this.scriptNode.connect(this.audioContext.destination);
  }

  async loadAudio(audioFile: File): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Clean up previous source if it exists
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Create and configure source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    
    // Connect nodes for playback and analysis
    this.sourceNode.connect(this.gainNode!);
    
    // Set up transient detection
    this.scriptNode!.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const transients = this.transientDetector.detectTransients(
        inputData,
        this.audioContext!.sampleRate
      );
      
      // Notify about detected transients
      transients.forEach(time => {
        if (this.onTransientCallback) {
          this.onTransientCallback(time);
        }
      });
    };

    return audioBuffer;
  }

  setTransientThreshold(threshold: number) {
    this.transientDetector.setThreshold(threshold);
  }

  onTransient(callback: (time: number) => void) {
    this.onTransientCallback = callback;
  }

  play() {
    if (!this.sourceNode) throw new Error('No audio loaded');
    this.sourceNode.start();
  }

  pause() {
    if (!this.sourceNode) return;
    this.sourceNode.stop();
    // Create new source node for resuming later
    const buffer = this.sourceNode.buffer;
    this.sourceNode = this.audioContext!.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.connect(this.gainNode!);
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  cleanup() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }
  }

  async extractAudioFromVideo(videoFile: File): Promise<Blob> {
    return await ffmpeg.extractAudio(videoFile);
  }
}

export const audioProcessor = new AudioProcessor(); 