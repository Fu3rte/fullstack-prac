# --- 第一阶段：构建源码 ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- 第二阶段：Nginx 生产托管 ---
FROM nginx:alpine
# 将第一阶段打包出的 dist 静态资源移入 Nginx 默认静态托管目录
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
