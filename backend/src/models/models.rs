use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub file_name: String,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioInfo {
    pub id: String,
    pub file_name: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Invalid file format")]
    InvalidFormat,
    #[error("Processing error: {0}")]
    ProcessingError(String),
}