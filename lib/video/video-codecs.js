/**
 * WebCodecs-based video processing utilities for Swappy
 * Provides smooth, hardware-accelerated video playback
 */

import MP4Box from 'mp4box';

export class VideoCodecsDecoder {
	constructor() {
		this.mp4boxfile = null;
		this.videoDecoder = null;
		this.videoTrack = null;
		this.frameQueue = [];
		this.isInitialized = false;
		this.onFrame = null;
		this.onReady = null;
		this.videoInfo = null;
	}

	async initialize(file) {
		try {
			// Check WebCodecs support
			if (!window.VideoDecoder) {
				throw new Error('WebCodecs API not supported in this browser');
			}

			await this.setupMP4Box(file);
			this.isInitialized = true;
			return true;
		} catch (error) {
			console.error('Failed to initialize video decoder:', error);
			return false;
		}
	}

	setupMP4Box(file) {
		return new Promise((resolve, reject) => {
			const arrayBuffer = file.arrayBuffer ? file.arrayBuffer() : file;
			
			arrayBuffer.then(buffer => {
				buffer.fileStart = 0;
				
				this.mp4boxfile = MP4Box.createFile();
				this.mp4boxfile.onError = reject;
				this.mp4boxfile.onReady = (info) => {
					this.handleMoovReady(info);
					resolve();
				};
				this.mp4boxfile.onSamples = (id, user, samples) => {
					this.handleSamples(id, samples);
				};

				this.mp4boxfile.appendBuffer(buffer);
				this.mp4boxfile.flush();
			}).catch(reject);
		});
	}

	handleMoovReady(info) {
		this.videoInfo = info;
		
		// Find video track
		this.videoTrack = info.tracks.find(track => track.type === 'video');
		if (!this.videoTrack) {
			throw new Error('No video track found in MP4 file');
		}

		const track = this.videoTrack;
		const avcC = this.getAvcCBox(track.id);
		
		if (!avcC) {
			throw new Error('No AVC configuration found');
		}

		// Create video decoder
		const config = {
			codec: track.codec,
			 codedWidth: track.video.width,
			 codedHeight: track.video.height,
			 description: avcC,
			hardwareAcceleration: 'prefer-hardware'
		};

		this.videoDecoder = new VideoDecoder({
			output: (frame) => this.handleDecodedFrame(frame),
			error: (error) => console.error('VideoDecoder error:', error)
		});

		this.videoDecoder.configure(config);

		if (this.onReady) {
			this.onReady({
				width: track.video.width,
				height: track.video.height,
				duration: track.duration / track.timescale,
				fps: track.video.timescale / track.video.sample_duration
			});
		}
	}

	getAvcCBox(trackId) {
		const track = this.mp4boxfile.getTrackById(trackId);
		for (const entry of track.mdia.minf.stbl.stsd.entries) {
			if (entry.avcC) {
				const stream = new MP4Box.DataStream(
					undefined,
					0,
					MP4Box.DataStream.BIG_ENDIAN
				);
				entry.avcC.write(stream);
				return stream.buffer;
			}
		}
		return null;
	}

	handleSamples(trackId, samples) {
		if (trackId !== this.videoTrack.id) return;

		for (const sample of samples) {
			const type = sample.is_sync ? 'key' : 'delta';
			const chunk = new EncodedVideoChunk({
				type: type,
				timestamp: sample.cts * 1000000 / this.videoTrack.video.timescale,
				data: sample.data
			});

			if (this.videoDecoder && this.videoDecoder.state === 'configured') {
				this.videoDecoder.decode(chunk);
			}
		}
	}

	handleDecodedFrame(frame) {
		// Clone and queue the frame
		const cloned = frame.clone();
		this.frameQueue.push(cloned);
		frame.close();

		if (this.onFrame) {
			this.onFrame(cloned);
		}
	}

	startDecoding() {
		if (this.mp4boxfile && this.videoTrack) {
			this.mp4boxfile.setExtractionOptions(this.videoTrack.id, null, {
				nbSamples: Infinity
			});
			this.mp4boxfile.start();
		}
	}

	getNextFrame() {
		return this.frameQueue.shift();
	}

	hasFrames() {
		return this.frameQueue.length > 0;
	}

	getQueueSize() {
		return this.frameQueue.length;
	}

	destroy() {
		if (this.videoDecoder) {
			this.videoDecoder.close();
		}
		if (this.mp4boxfile) {
			this.mp4boxfile.flush();
			this.mp4boxfile.onReady = null;
			this.mp4boxfile.onSamples = null;
		}
		// Clear frame queue
		this.frameQueue.forEach(frame => frame.close());
		this.frameQueue = [];
		this.isInitialized = false;
	}
}

/**
 * Video texture utilities for WebGL
 */
export class VideoTextureManager {
	constructor(gl) {
		this.gl = gl;
		this.textures = new Map();
		this.currentTexture = null;
	}

	createVideoTexture() {
		const gl = this.gl;
		const texture = gl.createTexture();
		
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		
		return texture;
	}

	uploadVideoFrame(frame, texture) {
		const gl = this.gl;
		
		gl.bindTexture(gl.TEXTURE_2D, texture);
		
		// Check if we can use texImage2D with VideoFrame
		if (typeof gl.texImage2D === 'function' && frame.format) {
			// Modern approach - direct VideoFrame upload
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				frame
			);
		} else {
			// Fallback - convert to bitmap first
			frame.createImageBitmap().then(bitmap => {
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					bitmap
				);
			});
		}
	}

	destroy() {
		const gl = this.gl;
		this.textures.forEach(texture => {
			gl.deleteTexture(texture);
		});
		this.textures.clear();
	}
}
