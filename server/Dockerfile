FROM rust:1.86-slim AS builder

WORKDIR /build

COPY Cargo.toml Cargo.lock .
RUN mkdir src
COPY .empty.rs src/main.rs
RUN cargo fetch
RUN cargo build --release

COPY . .
RUN cargo build --release

FROM alpine

WORKDIR /app

COPY --from=builder /build/target/release/voteapp-server .

EXPOSE 5000

CMD [ "./voteapp-server" ]
