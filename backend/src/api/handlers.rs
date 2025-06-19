use std::sync::Arc;
use axum::{
    extract::{Multipart, Path},
    http::StatusCode,
    response::IntoResponse,
};
use tower_http::services::ServeFile;
use tokio::fs;

use crate::{
    models::{AudioInfo, VideoInfo, AppError},
    services::{audio_service, video_service},
};

pub async fn upload_video(mut multipart: Multipart) -> Result<impl IntoResponse, StatusCode> {
    while let Some(field) = multipart.next_field().await.map_err(|_| StatusCode::BAD_REQUEST)? {
        if field.name() == Some("video") {
            let id = uuid::Uuid::new_v4().to_string();
            let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
            
            video_service::save_video(&id, &data)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            return Ok(id);
        }
    }
    
    Err(StatusCode::BAD_REQUEST)
}

pub async fn get_video(Path(video_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let video_path = video_service::get_video_path(&video_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    let file = fs::File::open(&video_path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    Ok(file)
}

pub async fn list_videos() -> Result<impl IntoResponse, StatusCode> {
    let videos = video_service::list_videos()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(axum::Json(videos))
}

pub async fn get_video_info(Path(video_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let video = video_service::get_video_info(&video_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    Ok(axum::Json(video))
}

pub async fn upload_audio(mut multipart: Multipart) -> Result<impl IntoResponse, StatusCode> {
    while let Some(field) = multipart.next_field().await.map_err(|_| StatusCode::BAD_REQUEST)? {
        if field.name() == Some("audio") {
            let id = uuid::Uuid::new_v4().to_string();
            let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
            
            audio_service::save_audio(&id, &data)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            return Ok(id);
        }
    }
    
    Err(StatusCode::BAD_REQUEST)
}

pub async fn get_audio(Path(audio_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let audio_path = audio_service::get_audio_path(&audio_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    let file = fs::File::open(&audio_path).await.map_err(|_| StatusCode::NOT_FOUND)?;
    Ok(file)
}

pub async fn list_audio() -> Result<impl IntoResponse, StatusCode> {
    let audio_files = audio_service::list_audio()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(axum::Json(audio_files))
}

pub async fn get_audio_info(Path(audio_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let audio = audio_service::get_audio_info(&audio_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    Ok(axum::Json(audio))
}

pub async fn analyze_audio(Path(audio_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let analysis = audio_service::analyze_audio(&audio_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(axum::Json(analysis))
}

pub async fn get_audio_analysis(Path(audio_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let analysis = audio_service::get_audio_analysis(&audio_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    Ok(axum::Json(analysis))
}