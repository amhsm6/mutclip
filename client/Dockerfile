FROM node:22-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json .
RUN npm install

COPY . .
RUN npm run build


FROM node:22-alpine

WORKDIR /app

COPY --from=builder /build/.next/standalone .
COPY --from=builder /build/.next/static .next/static

EXPOSE 3000

CMD [ "node", "server" ]
