FROM golang:1.23.4-alpine AS builder

WORKDIR /build

COPY go.mod go.sum .
RUN go mod download

COPY . .
RUN go build -o bin/server -ldflags '-s -w' ./cmd/server


FROM alpine

WORKDIR /app

COPY --from=builder /build/bin/server .

EXPOSE 5000

CMD [ "./server" ]
