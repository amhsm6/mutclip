.PHONY: server
run-server:
	go build -C server -o bin/ ./...
	./server/bin/server

build-server:
	go build -C server -o bin/ -ldflags '-s -w' ./...

clean-server:
	rm -rf server/bin

.PHONY: client
run-client:
	cd client; npm run dev

build-client:
	cd client; npm run build && npm run extract

clean-client:
	rm -rf client/dist.tar.gz client/node_modules

init-client:
	cd client; npm i

init: init-client proto

clean: clean-server clean-client clean-proto

reproto: clean-proto proto

.PHONY: proto
proto:
	mkdir -p client/src/pb
	protoc -I=proto --go_out=server/pkg --ts_proto_out=client/src/pb --plugin=client/node_modules/.bin/protoc-gen-ts_proto proto/*.proto

clean-proto:
	rm -rf server/pkg/pb client/src/pb
