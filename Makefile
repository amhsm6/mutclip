build: proto build-server build-client

push: push-server push-client

init: init-client proto

clean: clean-server clean-client clean-proto


.PHONY: proto
proto: init-client
	mkdir -p client/src/pb
	protoc -I=proto --go_out=server/pkg --ts_proto_out=client/src/pb --plugin=client/node_modules/.bin/protoc-gen-ts_proto proto/*.proto

clean-proto:
	rm -rf server/pkg/pb client/src/pb

reproto: clean-proto proto


build-server:
	docker build server -t aantonm/mutclip:server

push-server:
	docker push aantonm/mutclip:server

dev-server:
	set -a && . ./.env && set +a && cd server && CI=1 CLICOLOR_FORCE=1 air

clean-server:
	rm -rf server/bin


build-client:
	docker build client -t aantonm/mutclip:client

push-client:
	docker push aantonm/mutclip:client

dev-client:
	set -a && . ./.env && set +a && cd client && npm run dev

init-client:
	cd client && npm install

clean-client:
	rm -rf client/node_modules client/.next
