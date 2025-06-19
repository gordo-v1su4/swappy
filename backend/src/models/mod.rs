mod models;

pub use models::{VideoInfo, AudioInfo, AppError};

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfo {
    pub id: String,
    pub file_name: String,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioInfo {
    pub id: String,
    pub file_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioAnalysis {
    pub id: String,
    pub markers: Vec<f32>,
    pub transients: Vec<f32>,
    pub waveform: Vec<f32>,
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<AppError> for axum::http::StatusCode {
    fn from(error: AppError) -> Self {
        match error {
            AppError::NotFound(_) => axum::http::StatusCode::NOT_FOUND,
            AppError::InvalidInput(_) => axum::http::StatusCode::BAD_REQUEST,
            _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
} 