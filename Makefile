build: proto build-server build-client

deploy:
	kubectl apply -f kube/namespace.yaml,kube
	kubectl rollout restart deploy -n mutclip

init: init-client proto

clean: clean-server clean-client clean-proto


.PHONY: proto
proto:
	mkdir -p client/src/pb
	protoc -I=proto --go_out=server/pkg --ts_proto_out=client/src/pb --plugin=client/node_modules/.bin/protoc-gen-ts_proto proto/*.proto

clean-proto:
	rm -rf server/pkg/pb client/src/pb

reproto: clean-proto proto


build-server:
	docker build server -t localhost:31509/mutclip-server
	docker push localhost:31509/mutclip-server

dev-server:
	set -a && . ./.env && set +a && cd server && CI=1 CLICOLOR_FORCE=1 air

clean-server:
	rm -rf server/bin


build-client:
	docker build client -t localhost:31509/mutclip-client
	docker push localhost:31509/mutclip-client

dev-client:
	set -a && . ./.env && set +a && cd client; npm run dev

init-client:
	cd client && npm install

clean-client:
	rm -rf client/node_modules
