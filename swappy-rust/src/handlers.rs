use axum::extract::{Multipart, Path};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use uuid::Uuid;

use crate::models::VideoInfo;
use crate::services::{video_service, audio_service};

#[derive(Serialize)]
pub struct UploadResponse {
    pub id: String,
    pub filename: String,
    pub size: u64,
    pub message: String,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub async fn upload_video(mut multipart: Multipart) -> Result<Json<UploadResponse>, StatusCode> {
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("unknown").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        
        if name == "video" {
            let data = field.bytes().await.unwrap();
            let video_id = Uuid::new_v4().to_string();
            
            info!("📹 Uploading video: {} ({} bytes)", filename, data.len());
            
            match video_service::save_video(&video_id, &filename, &data).await {
                Ok(video_info) => {
                    return Ok(Json(UploadResponse {
                        id: video_id,
                        filename: filename.clone(),
                        size: data.len() as u64,
                        message: "Video uploaded successfully".to_string(),
                    }));
                }
                Err(e) => {
                    error!("Failed to save video: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
    }
    
    Err(StatusCode::BAD_REQUEST)
}

pub async fn upload_audio(mut multipart: Multipart) -> Result<Json<UploadResponse>, StatusCode> {
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("unknown").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        
        if name == "audio" {
            let data = field.bytes().await.unwrap();
            let audio_id = Uuid::new_v4().to_string();
            
            info!("🎵 Uploading audio: {} ({} bytes)", filename, data.len());
            
            match audio_service::save_audio(&audio_id, &filename, &data).await {
                Ok(audio_info) => {
                    return Ok(Json(UploadResponse {
                        id: audio_id,
                        filename: filename.clone(),
                        size: data.len() as u64,
                        message: "Audio uploaded successfully".to_string(),
                    }));
                }
                Err(e) => {
                    error!("Failed to save audio: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
    }
    
    Err(StatusCode::BAD_REQUEST)
}

pub async fn list_videos() -> Json<Vec<VideoInfo>> {
    match video_service::list_videos().await {
        Ok(videos) => Json(videos),
        Err(_) => Json(vec![]),
    }
}

pub async fn get_thumbnail(Path(id): Path<String>) -> impl IntoResponse {
    match video_service::get_thumbnail(&id).await {
        Ok(thumbnail_data) => {
            (StatusCode::OK, [("content-type", "image/jpeg")], thumbnail_data)
        }
        Err(_) => {
            (StatusCode::NOT_FOUND, [("content-type", "text/plain")], vec![])
        }
    }
}

#[derive(Deserialize)]
pub struct AnalyzeAudioRequest {
    pub audio_id: String,
    pub sensitivity: Option<f32>,
}

#[derive(Serialize)]
pub struct AnalyzeAudioResponse {
    pub markers: Vec<f32>,
    pub duration: f32,
    pub sample_rate: u32,
}

pub async fn analyze_audio(Json(request): Json<AnalyzeAudioRequest>) -> Result<Json<AnalyzeAudioResponse>, StatusCode> {
    let sensitivity = request.sensitivity.unwrap_or(0.5);
    
    info!("🎯 Analyzing audio: {} (sensitivity: {})", request.audio_id, sensitivity);
    
    match audio_service::analyze_transients(&request.audio_id, sensitivity).await {
        Ok(analysis) => {
            Ok(Json(AnalyzeAudioResponse {
                markers: analysis.markers,
                duration: analysis.duration,
                sample_rate: analysis.sample_rate,
            }))
        }
        Err(e) => {
            error!("Failed to analyze audio: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}