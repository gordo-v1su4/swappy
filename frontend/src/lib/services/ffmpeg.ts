import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loaded = false;

export async function initializeFFmpeg() {
  if (loaded) return;

  ffmpegInstance = new FFmpeg();
  
  // Load FFmpeg core
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  loaded = true;
}

export async function generateThumbnail(videoFile: File, time = 0): Promise<Blob> {
  if (!ffmpegInstance) throw new Error('FFmpeg not initialized');
  
  const inputFileName = 'input' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
  const outputFileName = 'thumbnail.jpg';

  await ffmpegInstance.writeFile(inputFileName, new Uint8Array(await videoFile.arrayBuffer()));
  
  await ffmpegInstance.exec([
    '-i', inputFileName,
    '-ss', time.toString(),
    '-frames:v', '1',
    '-q:v', '2',
    '-vf', 'scale=320:-1',
    outputFileName
  ]);

  const data = await ffmpegInstance.readFile(outputFileName);
  return new Blob([data], { type: 'image/jpeg' });
}

export async function trimVideo(videoFile: File, start: number, end: number): Promise<Blob> {
  if (!ffmpegInstance) throw new Error('FFmpeg not initialized');
  
  const inputFileName = 'input' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
  const outputFileName = 'output.mp4';

  await ffmpegInstance.writeFile(inputFileName, new Uint8Array(await videoFile.arrayBuffer()));
  
  await ffmpegInstance.exec([
    '-i', inputFileName,
    '-ss', start.toString(),
    '-t', (end - start).toString(),
    '-c:v', 'copy',
    '-c:a', 'copy',
    outputFileName
  ]);

  const data = await ffmpegInstance.readFile(outputFileName);
  return new Blob([data], { type: 'video/mp4' });
}

export async function extractAudio(videoFile: File): Promise<Blob> {
  if (!ffmpegInstance) throw new Error('FFmpeg not initialized');
  
  const inputFileName = 'input' + videoFile.name.substring(videoFile.name.lastIndexOf('.'));
  const outputFileName = 'audio.mp3';

  await ffmpegInstance.writeFile(inputFileName, new Uint8Array(await videoFile.arrayBuffer()));
  
  await ffmpegInstance.exec([
    '-i', inputFileName,
    '-vn',
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    outputFileName
  ]);

  const data = await ffmpegInstance.readFile(outputFileName);
  return new Blob([data], { type: 'audio/mp3' });
}

export async function concatenateVideos(videos: File[]): Promise<Blob> {
  if (!ffmpegInstance) throw new Error('FFmpeg not initialized');
  if (!videos.length) throw new Error('No videos to concatenate');

  // Create a file list for concatenation
  let fileList = '';
  const inputFiles: string[] = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const fileName = `input${i}${video.name.substring(video.name.lastIndexOf('.'))}`;
    await ffmpegInstance.writeFile(fileName, new Uint8Array(await video.arrayBuffer()));
    fileList += `file '${fileName}'\n`;
    inputFiles.push(fileName);
  }

  // Write the file list
  await ffmpegInstance.writeFile('filelist.txt', fileList);

  // Concatenate videos
  await ffmpegInstance.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'filelist.txt',
    '-c', 'copy',
    'output.mp4'
  ]);

  const data = await ffmpegInstance.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
}

export async function cleanup() {
  if (ffmpegInstance) {
    await ffmpegInstance.terminate();
    ffmpegInstance = null;
    loaded = false;
  }
} 