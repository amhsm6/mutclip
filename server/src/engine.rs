use std::pin::Pin;
use std::sync::Arc;
use std::collections::HashMap;
use futures::channel::mpsc;
use futures::channel::mpsc::{Sender, Receiver};
use futures::prelude::*;
use anyhow::{bail, Result, Error};
use log::{error, info};
use rand::distr::Alphanumeric;
use rand::prelude::*;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::pb::clip::Message;
use crate::pb::clip::message::Msg;

type Cid = Uuid;

type Tx = Pin<Box<dyn Sink<Message, Error = Error> + Send>>;
type Rx = Pin<Box<dyn Stream<Item = Message> + Send>>;

#[derive(Clone)]
pub struct Engine {
    clipboards: Arc<Mutex<HashMap<String, Clipboard>>>
}

struct Clipboard {
    contents: ClipContents,
    clients: HashMap<Uuid, Client>,
    intx: Sender<(Cid, Message)>,
    inrx: Receiver<(Cid, Message)>
}

enum ClipContents {
    Text(String),
    File(String)
}

struct Client {
    cid: Cid,
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

    pub async fn connect(&self, id: String, mut tx: Tx, rx: Rx) -> Result<()> {
        let mut clips = self.clipboards.lock().await;

        let Some(clip) = clips.get_mut(&id) else {
            tx.send(Message { msg: Some(Msg::Err(crate::pb::clip::Error { desc: "Invalid id".into() })) }).await?;
            bail!("Invalid id: {id}");
        };

        let cid = Uuid::now_v7();
        let client = Client { cid, tx };

        clip.clients.insert(cid, client);

        let intx = clip.intx.clone();
        tokio::spawn(async move {
            rx
                .map(|m| Ok((cid, m)))
                .forward(intx).await
                .unwrap_or_else(|e| error!("{e}"));
        });

        Ok(())
    }

    pub async fn start(&self, id: String) -> Result<()> {
        if !self.clipboards.lock().await.contains_key(&id) {
            bail!("Invalid id: {id}");
        }

        let clips = self.clipboards.clone();
        tokio::spawn(async move {
            info!("* START {id}");

            loop {
                let Some((cid, m)) = clips.lock().await
                    .get_mut(&id).unwrap()
                    .inrx
                    .next().await else { break; };

                let m = match m.msg {
                    Some(m) => m,
                    None => {
                        error!("Received empty message from {cid}");
                        clips.lock().await
                            .get_mut(&id).unwrap()
                            .clients.get_mut(&cid).unwrap()
                            .tx.send(Message { msg: Some(Msg::Err(crate::pb::clip::Error { desc: "Empty message".into() })) }).await
                            .unwrap_or_else(|e| error!("{e}"));
                        
                        continue;
                    }
                };
            
            }

            info!("* DONE {id}");
        });

        Ok(())
    }
}

impl Clipboard {
    fn new() -> Clipboard {
        let (tx, rx) = mpsc::channel(15);        
        Clipboard {
            contents: ClipContents::Text("".into()),
            clients: HashMap::new(),
            intx: tx,
            inrx: rx
        }
    }
}
