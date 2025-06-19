use crate::models::VideoInfo;
use anyhow::Result;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tokio::sync::Mutex;
use tracing::{error, info};
use chrono::Utc;
use lazy_static::lazy_static;

// In-memory storage for now (replace with database later)
lazy_static! {
    static ref VIDEOS: Mutex<HashMap<String, VideoInfo>> = Mutex::new(HashMap::new());
}

pub async fn save_video(id: &str, filename: &str, data: &[u8]) -> Result<VideoInfo> {
    // Create uploads directory if it doesn't exist
    let upload_dir = Path::new("uploads/videos");
    fs::create_dir_all(upload_dir)?;
    
    // Save video file
    let file_path = upload_dir.join(format!("{}_{}", id, filename));
    fs::write(&file_path, data)?;
    
    info!("💾 Saved video to: {:?}", file_path);
    
    // Create video info
    let video_info = VideoInfo {
        id: id.to_string(),
        filename: filename.to_string(),
        size: data.len() as u64,
        duration: None, // Will be populated when FFmpeg is available
        width: None,
        height: None,
        thumbnail_path: None,
        uploaded_at: Utc::now(),
    };
    
    // Store in memory
    let mut videos = VIDEOS.lock().await;
    videos.insert(id.to_string(), video_info.clone());
    
    // Generate thumbnail in background (placeholder for now)
    let video_id = id.to_string();
    tokio::spawn(async move {
        if let Err(e) = generate_thumbnail_placeholder(&video_id).await {
            error!("Failed to generate thumbnail for {}: {}", video_id, e);
        }
    });
    
    Ok(video_info)
}

pub async fn list_videos() -> Result<Vec<VideoInfo>> {
    let videos = VIDEOS.lock().await;
    Ok(videos.values().cloned().collect())
}

pub async fn get_thumbnail(id: &str) -> Result<Vec<u8>> {
    let thumbnail_path = format!("uploads/thumbnails/{}.jpg", id);
    if Path::new(&thumbnail_path).exists() {
        Ok(fs::read(thumbnail_path)?)
    } else {
        // Return a placeholder thumbnail
        generate_placeholder_thumbnail()
    }
}

async fn generate_thumbnail_placeholder(video_id: &str) -> Result<()> {
    // Create thumbnails directory
    let thumbnail_dir = Path::new("uploads/thumbnails");
    fs::create_dir_all(thumbnail_dir)?;
    
    // For now, create a simple placeholder
    // Later this will use FFmpeg to extract actual frames
    let placeholder_data = generate_placeholder_thumbnail()?;
    let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", video_id));
    fs::write(thumbnail_path, placeholder_data)?;
    
    info!("🖼️ Generated placeholder thumbnail for video: {}", video_id);
    Ok(())
}

fn generate_placeholder_thumbnail() -> Result<Vec<u8>> {
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
    img.write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageFormat::Jpeg)?;
    Ok(buffer)
}