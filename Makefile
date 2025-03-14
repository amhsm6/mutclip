build: proto
	docker compose build

push:
	docker compose push

pull:
	docker compose pull


init: init-client proto

clean: clean-server clean-client clean-proto


.PHONY: proto
proto:
	mkdir -p client/src/pb
	protoc -I=proto --go_out=server/pkg --ts_proto_out=client/src/pb --plugin=client/node_modules/.bin/protoc-gen-ts_proto proto/*.proto

clean-proto:
	rm -rf server/pkg/pb client/src/pb

reproto: clean-proto proto


dev-server:
	set -a && . ./.env && set +a && cd server && CI=1 CLICOLOR_FORCE=1 air

clean-server:
	rm -rf server/bin


dev-client:
	set -a && . ./.env && set +a && cd client; npm run dev

init-client:
	cd client && npm install

clean-client:
	rm -rf client/node_modules
