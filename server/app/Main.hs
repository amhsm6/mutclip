{-# LANGUAGE DataKinds #-}
{-# LANGUAGE FlexibleContexts #-}
{-# LANGUAGE TypeOperators #-}

module Main where

import Control.Monad
import Control.Monad.Reader
import Control.Lens
import Control.Concurrent
import Control.Concurrent.STM
import qualified Data.Map as M
import Data.Aeson.Lens
import System.IO (stdout, hSetBuffering, BufferMode(..))
import Servant
import Servant.API.WebSocket
import Network.Wai.Handler.Warp

import Clipboard

type Api = "newclip" :> Get '[JSON] String
      :<|> "ws" :> Capture "id" Int :> WebSocket

api :: Proxy Api
api = Proxy

type Clips = M.Map Int Clipboard

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
                  atomically $ do
                      modifyTVar tclips $ at clipboardId %~ maybe (Just $ Clipboard mempty mempty) Just
                  
                  let l :: Lens' Clips Clipboard
                      l = at clipboardId . lens (maybe undefined id) (flip $ set _Just)
                  runWorkerT (work clipboardId) $ State l tclips conn

main :: IO ()
main = do
    hSetBuffering stdout NoBuffering

    tclips <- atomically $ newTVar M.empty

    forkIO $ cleanup tclips

    putStrLn "Server is running on port 3015"
    run 3015 $ serve api $ hoistServer api (flip runReaderT tclips) server
