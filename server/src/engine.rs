use std::pin::Pin;
use std::sync::Arc;
use std::collections::HashMap;
use futures::prelude::*;
use anyhow::{bail, Error, Result};
use log::info;
use rand::distr::Alphanumeric;
use rand::prelude::*;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::pb::clip::Message;
use crate::pb::clip::message::Msg;

type Rx = Pin<Box<dyn Stream<Item = Message> + Send>>;
type Tx = Pin<Box<dyn Sink<Message, Error = Error> + Send>>;

#[derive(Clone)]
pub struct Engine {
    clipboards: Arc<Mutex<HashMap<String, Clipboard>>>
}

struct Clipboard {
    contents: ClipContents,
    clients: HashMap<Uuid, Client>
}

enum ClipContents {
    Text(String),
    File(String)
}

struct Client {
    cid: Uuid,
    rx: Rx,
    tx: Tx
}

impl Engine {
    pub fn new() -> Engine {
        Engine { clipboards: Arc::new(Mutex::new(HashMap::new())) }
    }

    pub async fn generate(&self) -> String {
        let mut clips = self.clipboards.lock().await;

        let rng = &mut rand::rng();

        let id = loop {
            let id = rng.sample_iter(Alphanumeric)
                .take(6)
                .map(|x| (x as char).to_ascii_lowercase())
                .enumerate()
                .flat_map(|(i, x)| { if i == 1 || i == 3 { vec![x, '-'] } else { vec![x] } })
                .collect::<String>();

            if !clips.contains_key(&id) { break id; }
        };

        clips.insert(id.clone(), Clipboard::new());

        info!("* GEN {id}");

        id
    }

    pub async fn check(&self, id: String) -> bool {
        let clips = self.clipboards.lock().await;
        clips.contains_key(&id)
    }

    pub async fn connect(&self, id: String, rx: Rx, mut tx: Tx) -> Result<()> {
        let mut clips = self.clipboards.lock().await;

        let Some(clip) = clips.get_mut(&id) else {
            tx.send(Message { msg: Some(Msg::Err(crate::pb::clip::Error { desc: "Invalid id".into() })) }).await?;
            bail!("Invalid id: {id}")
        };

        let client = Client {
            cid: Uuid::now_v7(),
            rx: rx,
            tx: tx
        };

        clip.clients.insert(client.cid, client);

        Ok(())
    }

    pub async fn start(&self, id: String) -> Result<()> {
        info!("* START {id}");
        loop {

        }
    }
}

impl Clipboard {
    fn new() -> Clipboard {
        Clipboard {
            contents: ClipContents::Text("".into()),
            clients: HashMap::new()
        }
    }
}
