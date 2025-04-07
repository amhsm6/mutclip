mod engine;
mod pb;

use futures::channel::mpsc;
use futures::{prelude::*, StreamExt};
use futures::stream::BoxStream;
use anyhow::{anyhow, bail, Error, Result};
use axum::Router;
use axum::extract::{Path, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::get;
use http::StatusCode;
use log::{error, info, warn, LevelFilter};
use tokio::net::TcpListener;
use prost::Message as _;

use engine::Engine;
use pb::clip::Message;

async fn newclip(State(engine): State<Engine>) -> impl IntoResponse {
    let id = engine.generate().await;

    engine.start(id.clone()).await
        .map
}

async fn check_clip(State(engine): State<Engine>, Path(id): Path<String>) -> impl IntoResponse {
    if engine.check(id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn ws(State(engine): State<Engine>, Path(id): Path<String>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(|ws| async move {
        let (tx, rx) = ws.split();

        let tx = tx
            .sink_map_err(Error::from)
            .with(|m: Message| async move {
                let mut buf =  Vec::new();
                m.encode(&mut buf)?;

                Ok(axum::extract::ws::Message::Binary(buf.into()))
            });

        let rx = rx
            .map_err(Error::from)
            .flat_map(|m| {
                let f = || -> Result<BoxStream<_>> {
                    match m? {
                        axum::extract::ws::Message::Binary(bytes) => {
                            Ok(Box::pin(stream::once(future::ready(Message::decode(bytes)?))))
                        }
                        axum::extract::ws::Message::Close(_) => {
                            warn!("WebSocket closed");
                            Ok(Box::pin(stream::empty()))
                        }
                        m => {
                            bail!("Unexpected websocket message: {m:?}");
                        }
                    }
                };

                match f() {
                    Ok(stream) => stream,
                    Err(e) => {
                        error!("{}\n{}", e, e.backtrace());
                        Box::pin(stream::empty())
                    }
                }
            });

        match engine.connect(id, Box::pin(tx), Box::pin(rx)).await {
            Ok(()) => {},
            Err(e) => {
                error!("{}\n{}", e, e.backtrace());
            }
        };
    })
}

async fn start() -> Result<()> {
    let app = Router::new()
        .route("/newclip", get(newclip))
        .route("/check/{id}", get(check_clip))
        .route("/ws/{id}", get(ws))
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
        Err(e) => error!("{}\n{}", e, e.backtrace())
    }
}
