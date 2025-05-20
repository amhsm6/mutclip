use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use futures::prelude::*;
use log::info;
use rand::distr::Alphanumeric;
use rand::Rng;
use tokio::select;
use tokio::sync::{broadcast, mpsc};
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::Mutex;
use tokio_util::sync::PollSender;
use uuid::Uuid;

use crate::pb::clip as pb;
use crate::pb::clip::message::Msg;
use crate::pb::clip::Message;
use crate::result::{Error, Result};

type ClipboardId = String;
type ClientId = Uuid;

#[derive(Clone)]
pub struct Engine {
    clipboards: Arc<Mutex<HashMap<ClipboardId, Clipboard>>>
}

#[derive(Clone)]
struct Clipboard {
    contents: Arc<Mutex<String>>, //FIXME
    clients: Arc<Mutex<HashMap<ClientId, Client>>>,
    intx: Sender<(ClientId, Result<Message>)>,
    context: broadcast::Sender<()>
}

struct Client {
    tx: Pin<Box<dyn Sink<Message, Error = Error> + Send>>,
    context: broadcast::Sender<()>
}

impl Engine {
    pub fn new() -> Engine {
        Engine {
            clipboards: Arc::new(Mutex::new(HashMap::new()))
        }
    }

    pub async fn generate(&self) -> String {
       let mut clips = self.clipboards.lock().await;

       let rng = &mut rand::rng();

       let id = loop {
           let id = rng
               .sample_iter(Alphanumeric)
               .take(6)
               .map(|x| (x as char).to_ascii_lowercase())
               .enumerate()
               .flat_map(|(i, x)| {
                   if i == 1 || i == 3 {
                       vec![x, '-']
                   } else {
                       vec![x]
                   }
               })
               .collect::<ClipboardId>();

           if !clips.contains_key(&id) {
               break id;
           }
       };

       clips.insert(id.clone(), Clipboard::start(id.clone()));

       info!("* GEN {id}");

       id
    }

    pub async fn check(&self, id: &str) -> bool {
       let clips = self.clipboards.lock().await;
       clips.contains_key(id)
    }

    pub async fn connect<Tx, Rx>(&self, clip_id: &str, tx: Tx, rx: Rx) -> Result<()>
    where Tx: Sink<Message, Error = Error> + Send + 'static,
          Rx: Stream<Item = Result<Message>> + Send + 'static
    {
        let mut clips = self.clipboards.lock().await;
        let Some(clip) = clips.get_mut(clip_id) else {
            return Err(Error::InvalidId);
        };

        let client_id = Uuid::now_v7();
        let client = Client::new(tx);

        let mut clip_ctx = clip.context.subscribe();
        let mut client_ctx = client.context.subscribe();
        let client_cancel = client.context.clone();
        let intx = clip.intx.clone();
        tokio::spawn(async move {
            let task = async {
                rx
                    .map(|m| Ok((client_id, m)))
                    .forward(PollSender::new(intx)).await.unwrap();
            };

            select! {
                _ = task => { client_cancel.send(()).unwrap(); }
                _ = clip_ctx.recv() => {}
                _ = client_ctx.recv() => {}
            }

            info!("Stop client {client_id}");
        });

        info!("Connect client {clip_id} {client_id}");

        clip.clients.lock().await.insert(client_id, client);

        Ok(())
    }
}

impl Clipboard {
    fn start(id: ClipboardId) -> Clipboard {
        let (intx, inrx) = mpsc::channel(15);
        let (context, mut ctx) = broadcast::channel(1);
        let clip = Clipboard {
            contents: Arc::new(Mutex::new("".into())),
            clients: Arc::new(Mutex::new(HashMap::new())),
            intx,
            context
        };

        let clip2 = clip.clone();
        tokio::spawn(async move {
            let clip = clip2;

            let task = async {
                loop {}
            };

            select! {
                _ = task => { clip.context.send(()).unwrap(); }
                _ = ctx.recv() => {}
            }

            info!("* DONE {id}");
        });

        clip
    }
}

impl Client {
    fn new<Tx: Sink<Message, Error = Error> + Send + 'static>(tx: Tx) -> Client {
        let (context, _) = broadcast::channel(1);
        Client {
            tx: Box::pin(tx),
            context
        }
    }
}

    /* 
#[derive(Clone)]
pub struct Engine {
    clipboards: Arc<Mutex<HashMap<String, Arc<Mutex<Clipboard>>>>>
}

struct Clipboard {
    contents: ClipContents,
    clients: HashMap<Uuid, Client>,
    intx: Sender<(Cid, Message)>,
    inrx: Receiver<(Cid, Message)>,
    tasks: Vec<JoinHandle<()>>
}

enum ClipContents {
    Text(String),
    File(String)
}

struct Client {
    cid: Cid,
    tx: Tx,
    tasks: Vec<JoinHandle<()>>
}

impl Engine {
    pub fn new() -> Engine {
        Engine {
            clipboards: Arc::new(Mutex::new(HashMap::new()))
        }
    }

    pub async fn connect(&self, id: String, mut tx: Tx, rx: Rx) -> Result<()> {
        let mut clips = self.clipboards.lock().await;

        let Some(clip) = clips.get_mut(&id) else {
            tx.send(Message { msg: Some(Msg::Err(pb::Error { desc: "Invalid id".into() })) }).await?;
            bail!("Invalid id: {id}");
        };
        let mut clip = clip.lock().await;

        let cid = Uuid::now_v7();

        let intx = clip.intx.clone();
        let task = tokio::spawn(async move {
            rx.map(|m| Ok((cid, m)))
                .forward(intx)
                .await
                .unwrap_or_else(|e| error!("{e}"));
        });

        let client = Client {
            cid,
            tx,
            tasks: vec![task]
        };

        clip.clients.insert(cid, client);

        Ok(())
    }

    pub async fn start(&self, id: String) -> Result<()> {
        let Some(clip) = self.clipboards.lock().await.get(&id).cloned() else {
            bail!("Invalid id: {id}");
        };

        let clip2 = clip.clone();

        let task = tokio::spawn(async move {
            info!("* START {id}");

            loop {
                let Some((cid, m)) = clip.lock().await.inrx.next().await else {
                    break;
                };

                let Some(m) = m.msg else {
                    error!("Received empty message from {cid}");

                    match clip.lock().await.clients.get_mut(&cid) {
                        Some(client) => {
                            client.tx.send(Message { msg: Some(Msg::Err(pb::Error { desc: "Empty message".into() })) }).await
                                .unwrap_or_else(|e| error!("{e}"));
                        }

                        None => error!("Invalid cid: {cid}")
                    }

                    continue;
                };

                info!("{m:?}");
            }

            info!("* DONE {id}");
        });

        clip2.lock().await.tasks.push(task);

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
            inrx: rx,
            tasks: Vec::new(),
        }
    }
}
    */
