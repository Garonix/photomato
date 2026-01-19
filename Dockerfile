# 阶段1: 构建前端
FROM node:20-alpine AS frontend
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 阶段2: 构建后端
FROM golang:1.24-alpine AS backend
ARG HTTP_PROXY=http://192.168.3.2:11088
ARG HTTPS_PROXY=http://192.168.3.2:11088
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /server ./cmd/server

# 阶段3: 最终镜像 (无代理设置)
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=backend /server .
COPY --from=frontend /app/web/dist ./web/dist
EXPOSE 8080
CMD ["./server"]
