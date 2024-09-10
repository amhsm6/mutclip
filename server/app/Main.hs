{-# LANGUAGE DataKinds #-}
{-# LANGUAGE FlexibleContexts #-}
{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE TemplateHaskell #-}

module Main where

import Control.Monad
import Control.Monad.Reader
import Control.Lens
import Control.Concurrent
import Control.Concurrent.STM
import Control.Exception (handle)
import qualified Data.Text.Lazy as T
import qualified Data.Map as M
import Data.Aeson.Lens
import Text.Printf
import Servant
import Servant.API.WebSocket
import Network.WebSockets
import Network.Wai.Handler.Warp

type Api = "newclip" :> Get '[JSON] String
      :<|> "ws" :> Capture "id" Int :> WebSocket

api :: Proxy Api
api = Proxy

type Clips = M.Map Int Clipboard

data Clipboard = Clipboard { _contents :: T.Text
                           , _clients :: M.Map Int Connection
                           }

makeLenses ''Clipboard

cleanup :: TVar Clips -> IO ()
cleanup tclips = forever $ do
    atomically $ do
        clips <- readTVar tclips
        forMOf_ (itraversed . filtered (M.null . view clients) . asIndex) clips $ \i -> do
            modifyTVar tclips $ at i .~ Nothing

    threadDelay 15

server :: ServerT Api (ReaderT (TVar Clips) Handler)
server = newclipH :<|> wsH
    where newclipH = do
              tclips <- ask
              liftIO $ atomically $ do
                  clips <- readTVar tclips
                  pure $ clips ^. pre (traverseMax . asIndex . to (+1)) . non 0 . re _JSON

          wsH clipboardId conn = do
              tclips <- ask
              liftIO $ do
                  connId <- atomically $ do
                      conns <- view (ix clipboardId . clients) <$> readTVar tclips
                      let connId = conns ^. pre (traverseMax . asIndex . to (+1)) . non 0

                      modifyTVar tclips $ at clipboardId . anon (Clipboard T.empty M.empty) (const False) . clients . at connId .~ Just conn

                      pure connId

                  putStrLn $ printf "[%d]: connect: %d" clipboardId connId

                  atomically (readTVar tclips) >>= sendTextData conn . view (ix clipboardId . contents)

                  let onClose :: ConnectionException -> IO ()
                      onClose _ = do
                          putStrLn $ printf "[%d]: disconnect: %d" clipboardId connId
                          atomically $ modifyTVar tclips $ ix clipboardId . clients . at connId .~ Nothing

                  handle onClose $ do
                      forever $ do
                          upd <- receiveData conn
                          atomically $ modifyTVar tclips $ ix clipboardId . contents .~ upd

                          atomically (readTVar tclips) >>= mapMOf_ (ix clipboardId . clients . traverse) (\c -> sendTextData c upd)

main :: IO ()
main = do
    tclips <- atomically $ newTVar M.empty

    forkIO $ cleanup tclips

    putStrLn "Server is running on port 3015"
    run 3015 $ serve api $ hoistServer api (flip runReaderT tclips) server
