use std::net::SocketAddr;
use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

mod api;
mod models;
mod services;

use crate::api::handlers;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build application with routes
    let app = Router::new()
        .route("/api/videos", post(handlers::upload_video))
        .route("/api/videos", get(handlers::list_videos))
        .route("/api/videos/:id", get(handlers::get_video))
        .route("/api/audio", post(handlers::upload_audio))
        .route("/api/audio", get(handlers::list_audio))
        .route("/api/audio/:id", get(handlers::get_audio))
        .layer(cors);

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 3002));
    info!("Listening on {}", addr);

    axum::serve(
        tokio::net::TcpListener::bind(addr)
            .await
            .expect("Failed to bind server"),
        app,
    )
    .await
    .expect("Failed to start server");
}