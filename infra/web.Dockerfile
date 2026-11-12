# Builds both front-ends and serves them with nginx, which also proxies /api.
# Build context: repository root.

FROM node:22-alpine AS mobile
WORKDIR /build
COPY mobile/package*.json ./
RUN npm ci
COPY mobile ./
RUN npm run build-only

FROM node:22-alpine AS admin
WORKDIR /build
COPY admin/package*.json ./
RUN npm ci
COPY admin ./
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=mobile /build/dist /usr/share/nginx/html
COPY --from=admin /build/dist /usr/share/nginx/html/admin
EXPOSE 80
