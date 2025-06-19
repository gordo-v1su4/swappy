use crate::models::VideoInfo;
use anyhow::Result;
use std::collections::HashMap;
use std::path::Path;
use tokio::sync::Mutex;
use tracing::{info};
use lazy_static::lazy_static;
use std::path::PathBuf;
use std::sync::Arc;
use once_cell::sync::Lazy;
use crate::models::AppError;
use bytes::Bytes;
use tokio::fs;

// Use Arc<Mutex> instead of lazy_static for async compatibility
static VIDEO_STORE: Lazy<Arc<Mutex<HashMap<String, VideoInfo>>>> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

lazy_static! {
    static ref VIDEO_DIR: PathBuf = PathBuf::from("uploads/videos");
    static ref THUMBNAIL_DIR: PathBuf = PathBuf::from("uploads/thumbnails");
}

pub async fn save_video(id: &str, data: &Bytes, file_name: &str) -> Result<(), AppError> {
    fs::create_dir_all(&*VIDEO_DIR).await?;
    fs::create_dir_all(&*THUMBNAIL_DIR).await?;
    
    let file_path = VIDEO_DIR.join(format!("{}_{}", id, file_name));
    fs::write(&file_path, data).await?;
    
    // Generate thumbnail
    let thumbnail_path = THUMBNAIL_DIR.join(format!("{}.jpg", id));
    generate_thumbnail(&file_path.to_string_lossy(), &thumbnail_path.to_string_lossy()).await?;
    
    info!("Saved video file: {}", file_path.display());
    Ok(())
}

pub async fn get_video_path(id: &str) -> Result<PathBuf, AppError> {
    let path = VIDEO_DIR.join(id);
    if fs::metadata(&path).await.is_ok() {
        Ok(path)
    } else {
        Err(AppError::NotFound(format!("Video not found: {}", id)))
    }
}

pub async fn list_videos() -> Result<Vec<VideoInfo>, AppError> {
    let mut videos = Vec::new();
    let mut entries = fs::read_dir(&*VIDEO_DIR).await?;

    while let Some(entry) = entries.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        let id = file_name.clone();
        let thumbnail_path = THUMBNAIL_DIR.join(&id);

        videos.push(VideoInfo {
            id,
            file_name,
            thumbnail_path: Some(thumbnail_path.to_string_lossy().into_owned()),
        });
    }

    Ok(videos)
}

pub async fn get_video_info(id: &str) -> Result<VideoInfo, AppError> {
    let mut entries = fs::read_dir(&*VIDEO_DIR).await?;

    while let Some(entry) = entries.next_entry().await? {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        if file_name == id {
            let thumbnail_path = THUMBNAIL_DIR.join(id);
            let thumbnail_exists = fs::metadata(&thumbnail_path).await.is_ok();

            return Ok(VideoInfo {
                id: id.to_string(),
                file_name,
                thumbnail_path: if thumbnail_exists {
                    Some(thumbnail_path.to_string_lossy().into_owned())
                } else {
                    None
                },
            });
        }
    }

    Err(AppError::NotFound(format!("Video not found: {}", id)))
}

async fn generate_thumbnail(video_path: &str, thumbnail_path: &str) -> Result<(), AppError> {
    // TODO: Implement thumbnail generation using ffmpeg
    // For now, we'll just create an empty file
    fs::write(thumbnail_path, &[]).await?;
    Ok(())
}

pub async fn get_thumbnail(id: &str) -> Result<Vec<u8>, AppError> {
    let thumbnail_path = format!("uploads/thumbnails/{}.jpg", id);
    if Path::new(&thumbnail_path).exists() {
        Ok(fs::read(&thumbnail_path).await?)
    } else {
        // Return a placeholder thumbnail
        generate_placeholder_thumbnail()
    }
}

async fn generate_thumbnail_placeholder(video_id: &str) -> Result<(), AppError> {
    // Create thumbnails directory
    let thumbnail_dir = Path::new("uploads/thumbnails");
    fs::create_dir_all(thumbnail_dir).await?;
    
    // For now, create a simple placeholder
    // Later this will use FFmpeg to extract actual frames
    let placeholder_data = generate_placeholder_thumbnail()?;
    let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", video_id));
    fs::write(thumbnail_path, placeholder_data).await?;
    
    info!("🖼️ Generated placeholder thumbnail for video: {}", video_id);
    Ok(())
}

fn generate_placeholder_thumbnail() -> Result<Vec<u8>, AppError> {
    use image::{ImageBuffer, Rgb};
    
    // Create a 320x180 placeholder image
    let img = ImageBuffer::from_fn(320, 180, |x, y| {
        let base = ((x + y) % 50) as u8;
        let intensity = (base * 5).min(255);
        let r = intensity;
        let g = (intensity.saturating_add(20)).min(255);
        let b = (intensity.saturating_add(40)).min(255);
        Rgb([r, g, b])
    });
    
    let mut buffer = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageFormat::Jpeg)
        .map_err(|e| AppError::ProcessingError(e.to_string()))?;
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_video_operations() {
        let id = uuid::Uuid::new_v4().to_string();
        let data = Bytes::from_static(b"test video data");
        let file_name = "test.mp4";
        
        // Test save
        save_video(&id, &data, file_name).await.unwrap();
        
        // Test get path
        let path = get_video_path(&id).await.unwrap();
        assert!(fs::metadata(&path).await.is_ok());
        
        // Test list
        let videos = list_videos().await.unwrap();
        assert!(videos.iter().any(|v| v.id == id));
        
        // Cleanup
        fs::remove_file(path).await.unwrap();
    }
}