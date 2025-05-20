use crate::pb::clip as pb;
use crate::pb::clip::Message;
use crate::pb::clip::message::Msg;

#[derive(Debug)]
pub enum Error {
    InvalidId,
    InvalidCid,
    UnexpectedMessage(String),
    Unknown(anyhow::Error)
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn serialize(&self) -> Message {
        match self {
            Error::InvalidId => Message { msg: Some(Msg::Err(pb::Error { desc: "Invalid ID".into() })) },
            Error::UnexpectedMessage(_) => Message { msg: Some(Msg::Err(pb::Error { desc: "Unexpected message".into() })) },
            _ => Message { msg: Some(Msg::Err(pb::Error { desc: "Internal Server Error".into() })) }
        }
    }
}

impl<E: std::error::Error + Send + Sync + 'static> From<E> for Error {
    fn from(e: E) -> Self {
        Error::Unknown(e.into())
    }
}
