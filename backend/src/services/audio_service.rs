use crate::models::{AudioInfo, AudioAnalysis};
use anyhow::Result;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tokio::sync::Mutex;
use tracing::info;
use chrono::Utc;
use lazy_static::lazy_static;
use std::{collections::HashMap, path::PathBuf, sync::Arc};
use once_cell::sync::Lazy;
use crate::models::{AppError};
use bytes::Bytes;
use uuid::Uuid;
use tokio::fs;

// Use Arc<Mutex> instead of lazy_static for async compatibility
static AUDIO_STORE: Lazy<Arc<Mutex<HashMap<String, AudioInfo>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

lazy_static! {
    static ref AUDIO_DIR: PathBuf = PathBuf::from("uploads/audio");
}

pub async fn save_audio(id: &str, data: &Bytes, file_name: &str) -> Result<(), AppError> {
    fs::create_dir_all(&*AUDIO_DIR).await?;
    
    let file_path = AUDIO_DIR.join(format!("{}_{}", id, file_name));
    fs::write(&file_path, data).await?;
    
    info!("Saved audio file: {}", file_path.display());
    Ok(())
}

pub async fn get_audio_path(id: &str) -> Result<PathBuf, AppError> {
    let path = AUDIO_DIR.join(id);
    if fs::metadata(&path).await.is_ok() {
        Ok(path)
    } else {
        Err(AppError::NotFound)
    }
}

pub async fn list_audio() -> Result<Vec<AudioInfo>, AppError> {
    let mut audio_files = Vec::new();
    let mut entries = fs::read_dir(&*AUDIO_DIR).await?;

    while let Some(entry) = entries.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        let id = file_name.clone();
        
        let metadata = fs::metadata(entry.path()).await?;
        let duration = 0.0; // TODO: Implement actual duration extraction

        audio_files.push(AudioInfo {
            id,
            filename: file_name,
            duration,
        });
    }

    Ok(audio_files)
}

pub async fn get_audio_info(id: &str) -> Result<AudioInfo, AppError> {
    let mut entries = fs::read_dir(&*AUDIO_DIR).await?;

    while let Some(entry) = entries.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if file_name == id {
            let metadata = fs::metadata(entry.path()).await?;
            let duration = 0.0; // TODO: Implement actual duration extraction

            return Ok(AudioInfo {
                id: id.to_string(),
                filename: file_name,
                duration,
            });
        }
    }

    Err(AppError::NotFound)
}

pub async fn analyze_audio(id: &str) -> Result<AudioAnalysis, AppError> {
    let path = get_audio_path(id).await?;
    
    // TODO: Implement actual audio analysis
    // For now, return dummy data
    Ok(AudioAnalysis {
        id: id.to_string(),
        duration: 180.0,
        sample_rate: 44100,
        transients: vec![0.0, 1.0, 2.0, 3.0],
        waveform: vec![0.0, 0.5, 1.0, 0.5, 0.0],
        peak_frequencies: vec![60.0, 120.0, 240.0, 480.0],
    })
}

pub async fn get_audio_analysis(id: &str) -> Result<AudioAnalysis, AppError> {
    let path = get_audio_path(id).await?;
    
    // TODO: Implement actual audio analysis retrieval
    // For now, return dummy data
    Ok(AudioAnalysis {
        id: id.to_string(),
        duration: 180.0,
        sample_rate: 44100,
        transients: vec![],
        waveform: vec![],
        peak_frequencies: vec![],
    })
}

pub async fn analyze_transients(audio_id: &str, sensitivity: f32) -> Result<AudioAnalysis> {
    let _file_path = format!("uploads/audio/{}_{}", audio_id, "audio_file");
    
    // For now, return mock data
    // Later this will implement actual FFT-based transient detection
    let mock_analysis = AudioAnalysis {
        markers: generate_mock_markers(sensitivity),
        duration: 180.0, // 3 minutes
        sample_rate: 44100,
        peak_frequencies: vec![60.0, 120.0, 240.0, 480.0],
    };
    
    info!("🎯 Generated {} transient markers for audio: {}", mock_analysis.markers.len(), audio_id);
    
    Ok(mock_analysis)
}

fn generate_mock_markers(sensitivity: f32) -> Vec<f32> {
    // Generate mock transient markers based on sensitivity
    let base_count = (180.0 * sensitivity * 2.0) as usize; // 2 markers per second at max sensitivity
    let mut markers = Vec::new();
    
    for i in 0..base_count {
        let time = (i as f32 / base_count as f32) * 180.0;
        markers.push(time);
    }
    
    // Add some variation to make it look more realistic
    for marker in markers.iter_mut() {
        *marker += (rand::random::<f32>() - 0.5) * 2.0; // Add ±1 second variation
        *marker = marker.max(0.0).min(180.0); // Clamp to valid range
    }
    
    markers.sort_by(|a, b| a.partial_cmp(b).unwrap());
    markers
}

// Placeholder for actual audio analysis implementation
#[allow(dead_code)]
pub async fn analyze_audio_waveform(_file_path: &Path) -> Result<AudioAnalysis> {
    // This will use rustfft and hound to:
    // 1. Load audio file
    // 2. Convert to mono if stereo
    // 3. Apply FFT in overlapping windows
    // 4. Detect transients using spectral flux or similar
    // 5. Return marker positions
    
    // For now, return mock data
    Ok(AudioAnalysis {
        markers: vec![10.0, 25.0, 42.0, 58.0, 75.0, 91.0, 108.0, 125.0, 142.0, 158.0],
        duration: 180.0,
        sample_rate: 44100,
        peak_frequencies: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_analyze_audio() {
        let analysis = analyze_audio("test").await.unwrap();
        assert_eq!(analysis.markers.len(), 4);
        assert_eq!(analysis.transients.len(), 3);
        assert_eq!(analysis.waveform.len(), 5);
    }
}