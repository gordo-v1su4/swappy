use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub filename: String,
    pub size: u64,
    pub duration: Option<f32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub thumbnail_path: Option<String>,
    pub uploaded_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioInfo {
    pub id: String,
    pub filename: String,
    pub size: u64,
    pub duration: Option<f32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub uploaded_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioAnalysis {
    pub markers: Vec<f32>,
    pub duration: f32,
    pub sample_rate: u32,
    pub peak_frequencies: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransientMarker {
    pub time: f32,
    pub intensity: f32,
    pub frequency_content: Vec<f32>,
}