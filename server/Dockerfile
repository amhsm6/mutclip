FROM rust:1.87-slim AS builder

WORKDIR /build

RUN rustup target add x86_64-unknown-linux-musl

COPY Cargo.toml Cargo.lock .

RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo fetch
RUN cargo build --release --target=x86_64-unknown-linux-musl

COPY . .
RUN touch src/main.rs
RUN cargo build --release --target=x86_64-unknown-linux-musl

FROM alpine

WORKDIR /app

COPY --from=builder /build/target/x86_64-unknown-linux-musl/release/mutclip-server .

EXPOSE 5000

CMD [ "./mutclip-server" ]
