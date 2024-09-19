{-# LANGUAGE RankNTypes #-}
{-# LANGUAGE ExistentialQuantification #-}
{-# LANGUAGE TemplateHaskell #-}

module Clipboard where

import Control.Monad
import Control.Monad.Reader
import Control.Lens
import Control.Concurrent
import Control.Concurrent.STM
import Control.Exception (Exception, SomeException, catch)
import qualified Data.ByteString.Lazy as B
import qualified Data.Text.Lazy as T
import qualified Data.Map as M
import Text.Printf
import Network.WebSockets (Connection, sendTextData, sendBinaryData, receiveData, withPingPong, defaultPingPongOptions)

type WorkerT = ReaderT State

data State = forall a. State (Lens' a Clipboard) (TVar a) Connection

data Clipboard = Clipboard { _contents :: B.ByteString
                           , _clients :: M.Map Int Connection
                           }

makeLenses ''Clipboard

runWorkerT :: WorkerT m a -> State -> m a
runWorkerT = runReaderT

atom :: WorkerT STM a -> WorkerT IO a
atom m = ask >>= liftIO . atomically . runWorkerT m

fork :: WorkerT IO () -> WorkerT IO ()
fork m = ask >>= void . liftIO . forkIO . runWorkerT m

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

pingpong :: WorkerT IO () -> WorkerT IO ()
pingpong m = do
    (State l x c) <- ask
    liftIO $ withPingPong defaultPingPongOptions c $ runWorkerT m . State l x

send :: B.ByteString -> Connection -> WorkerT IO ()
send msg conn = liftIO $ do
    sendTextData conn $ T.singleton 'A'
    sendBinaryData conn msg

recv :: WorkerT IO B.ByteString
recv = me >>= liftIO . receiveData

sync :: WorkerT IO ()
sync = me >>= \conn -> liftIO $ sendTextData conn $ T.singleton 'S'

handle :: Exception e => (e -> WorkerT IO a) -> WorkerT IO a -> WorkerT IO a
handle handler m = do
    s <- ask
    liftIO $ (runWorkerT m s) `catch` (\e -> runWorkerT (handler e) s)

work :: Int -> WorkerT IO ()
work clipboardId = do
    connId <- atom connect
    liftIO $ putStrLn $ printf "[%d] connect: %d" clipboardId connId

    let disconnect :: SomeException -> WorkerT IO ()
        disconnect _ = do
            liftIO $ putStrLn $ printf "[%d] disconnect: %d" clipboardId connId
            atom $ alter $ clients . at connId .~ Nothing

    handle disconnect $ do
        pingpong $ do
            join $ liftM2 send (atom $ view contents <$> get) me

            forever $ do
                upd <- recv
                atom $ alter $ contents .~ upd

                liftIO $ putStrLn $ printf "[%d] FROM %d %s" clipboardId connId (show $ B.take 1024 upd)

                tsent <- atom $ lift $ newTVar 0

                s <- atom get
                iforMOf_ (clients . itraversed . ifiltered (const . (/=connId))) s $ \i c -> do
                    fork $ do
                        liftIO $ putStrLn $ printf "[%d] TO %d" clipboardId i
                        send upd c

                        atom $ lift $ modifyTVar tsent (+1)

                let msgs = length (s ^. clients) - 1
                atom $ lift $ readTVar tsent >>= check . (==msgs)

                liftIO $ putStrLn $ printf "[%d] SYNC %d" clipboardId connId
                sync
