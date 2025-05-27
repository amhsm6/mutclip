mod engine;
mod result;
mod pb;

use std::sync::Arc;

use axum::routing;
use axum::extract::{ws, Path, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::Router;
use futures::prelude::*;
use futures::stream::BoxStream;
use http::StatusCode;
use log::{debug, error, info, warn, LevelFilter};
use prost::Message as _;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

use engine::Engine;
use result::{Result, Error};
use pb::clip::Message;

async fn newclip(State(engine): State<Engine>) -> impl IntoResponse {
    engine.generate().await
}

async fn check_clip(State(engine): State<Engine>, Path(id): Path<String>) -> impl IntoResponse {
    info!("* CHECK {id}");

    if engine.check(&id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn ws(
    State(engine): State<Engine>,
    Path(id): Path<String>,
    ws: WebSocketUpgrade
) -> impl IntoResponse {
    ws.on_upgrade(|ws| async move {
        let (tx, rx) = ws.split();

        let tx = tx
            .sink_map_err(Error::from)
            .with(|m: Message| async move {
                let mut buf = Vec::new();
                m.encode(&mut buf)?;

                Ok(ws::Message::Binary(buf.into()))
            });

        let rx = rx
            .map_err(Error::from)
            .flat_map(|m| -> BoxStream<_> {
                let f = || -> Result<BoxStream<_>> {
                    match m? {
                        ws::Message::Binary(bytes) => {
                            Ok(Box::pin(stream::once(future::ready(Message::decode(bytes)?))))
                        }
                        ws::Message::Close(_) => {
                            debug!("WebSocket closed");
                            Ok(Box::pin(stream::empty()))
                        }
                        m => {
                            Err(Error::UnexpectedMessage(format!("{:?}", m)))
                        }
                    }
                };

                match f() {
                    Ok(stream) => Box::pin(stream.map(Ok)),
                    Err(e) => Box::pin(stream::once(future::ready(Err(e))))
                }
            });

        match engine.connect(&id, tx, rx).await {
            Ok(()) => {}
            Err(e) => error!("{:?}\n", e)
        }
    })
}

async fn start() -> Result<()> {
    let app = Router::new()
        .route("/newclip", routing::get(newclip))
        .route("/check/{id}", routing::get(check_clip))
        .route("/ws/{id}", routing::get(ws))
        .with_state(Engine::new());

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
        Err(e) => error!("{:?}", e)
    }
}
