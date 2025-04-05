use anyhow::Result;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use log::{error, info, LevelFilter};
use tokio::net::TcpListener;

async fn index() -> impl IntoResponse {
    "index"
}

async fn start() -> Result<()> {
    let app = Router::new().route("/", get(index));

    info!("Server started on port 5000");

    let listener = TcpListener::bind("0.0.0.0:5000").await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[tokio::main]
async fn main() {
    env_logger::builder().filter_level(LevelFilter::Info).init();

    match start().await {
        Ok(()) => unreachable!(),
        Err(e) => error!("{}\n{}", e, e.backtrace())
    }
}
