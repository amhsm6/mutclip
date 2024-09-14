{-# LANGUAGE RankNTypes #-}
{-# LANGUAGE ExistentialQuantification #-}
{-# LANGUAGE TemplateHaskell #-}

module Clipboard where

import Control.Monad
import Control.Monad.Reader
import Control.Lens
import Control.Concurrent.STM
import Control.Exception (Exception, catch)
import qualified Data.Text.Lazy as T
import qualified Data.Map as M
import Text.Printf
import Network.WebSockets (Connection, sendTextData, receiveData, ConnectionException)

type WorkerT = ReaderT State

data State = forall a. State (Lens' a Clipboard) (TVar a) Connection

data Clipboard = Clipboard { _contents :: T.Text
                           , _clients :: M.Map Int Connection
                           }

makeLenses ''Clipboard

runWorkerT :: WorkerT m a -> State -> m a
runWorkerT = runReaderT

atom :: WorkerT STM a -> WorkerT IO a
atom m = ask >>= liftIO . atomically . runWorkerT m

get :: WorkerT STM Clipboard
get = do
    (State l x _) <- ask
    lift $ view l <$> readTVar x

alter :: (Clipboard -> Clipboard) -> WorkerT STM ()
alter f = do
    (State l x _) <- ask
    lift $ modifyTVar x $ over l f

me :: Monad m => WorkerT m Connection
me = do
    (State _ _ c) <- ask
    pure c

connect :: WorkerT STM Int
connect = do
    connId <- view (clients . pre (traverseMax . asIndex . to (+1)) . non 0) <$> get
    me >>= \conn -> alter $ clients . at connId .~ Just conn

    pure connId

send :: T.Text -> Connection -> WorkerT IO ()
send msg conn = liftIO $ do
    sendTextData conn $ T.singleton 'A'
    sendTextData conn $ 'M' `T.cons` msg

recv :: WorkerT IO T.Text
recv = me >>= liftIO . receiveData

sync :: WorkerT IO ()
sync = me >>= \conn -> liftIO $ sendTextData conn $ T.singleton 'Y'

handle :: Exception e => (e -> WorkerT IO a) -> WorkerT IO a -> WorkerT IO a
handle handler m = do
    s <- ask
    liftIO $ (runWorkerT m s) `catch` (\e -> runWorkerT (handler e) s)

work :: Int -> WorkerT IO ()
work clipboardId = do
    connId <- atom connect
    liftIO $ putStrLn $ printf "[%d]: connect: %d" clipboardId connId

    join $ liftM2 send (atom $ view contents <$> get) me

    let onClose :: ConnectionException -> WorkerT IO ()
        onClose _ = do
            liftIO $ putStrLn $ printf "[%d]: disconnect: %d" clipboardId connId
            atom $ alter $ clients . at connId .~ Nothing

    handle onClose $ do
        forever $ do
            upd <- recv
            atom $ alter $ contents .~ upd

            liftIO $ putStrLn $ printf "[%d] FROM %d: %s" clipboardId connId $ T.take 1024 upd

            s <- atom get
            iforMOf_ (clients . itraversed . ifiltered (const . (/=connId))) s $ \i c -> do
                liftIO $ putStrLn $ printf "[%d] TO %d" clipboardId i
                send upd c

            liftIO $ putStrLn $ printf "[%d] SYNC %d" clipboardId connId
            sync
