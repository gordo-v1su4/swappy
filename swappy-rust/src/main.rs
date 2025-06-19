use axum::extract::DefaultBodyLimit;
use axum::http::header::CONTENT_TYPE;
use axum::http::Method;
use axum::response::Json;
use axum::routing::{get, post};
use axum::Router;
use serde::Serialize;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tracing::info;

mod handlers;
mod models;
mod services;

#[derive(Serialize)]
struct ApiResponse {
    status: String,
    message: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([CONTENT_TYPE])
        .allow_origin(Any);

    // Build our application with routes
    let app = Router::new()
        .route("/", get(root))
        .route("/api/health", get(health_check))
        .route("/api/upload/video", post(handlers::upload_video))
        .route("/api/upload/audio", post(handlers::upload_audio))
        .route("/api/videos", get(handlers::list_videos))
        .route("/api/videos/:id/thumbnail", get(handlers::get_thumbnail))
        .route("/api/audio/analyze", post(handlers::analyze_audio))
        .layer(cors)
        .layer(DefaultBodyLimit::max(500 * 1024 * 1024)) // 500MB limit
        .layer(RequestBodyLimitLayer::new(500 * 1024 * 1024));

    let addr = SocketAddr::from(([127, 0, 0, 1], 3002));
    info!("🚀 Swappy Rust backend starting on http://{}", addr);

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn root() -> Json<ApiResponse> {
    Json(ApiResponse {
        status: "success".to_string(),
        message: "Swappy Rust Backend API".to_string(),
    })
}

async fn health_check() -> Json<ApiResponse> {
    Json(ApiResponse {
        status: "healthy".to_string(),
        message: "Server is running".to_string(),
    })
}