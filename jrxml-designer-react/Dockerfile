# Imagem do designer (ADR-019 §1): SPA + proxy reverso da API (origem única).
# Contexto = RAIZ do repositório (workspace pnpm):
#   docker build -f jrxml-designer-react/Dockerfile -t reportlenz-designer .

FROM node:24-slim AS build
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY jrxml-core/package.json jrxml-core/
COPY jrxml-designer-react/package.json jrxml-designer-react/
RUN pnpm install --frozen-lockfile
COPY jrxml-core jrxml-core
COPY jrxml-designer-react jrxml-designer-react
RUN pnpm --dir jrxml-core build && pnpm --dir jrxml-designer-react build

# nginx sem root (porta 8080).
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY jrxml-designer-react/deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=0755 jrxml-designer-react/deploy/40-config-json.sh /docker-entrypoint.d/40-config-json.sh
COPY --from=build --chown=101:101 /src/jrxml-designer-react/dist /usr/share/nginx/html
# RENDER_SERVICE_URL: destino do proxy · OIDC_*: /config.json (vazio = modo dev, sem login)
ENV RENDER_SERVICE_URL=http://render-service:8087 \
    OIDC_AUTHORITY="" \
    OIDC_CLIENT_ID=reportlenz \
    OIDC_ORIGEM="" \
    MAX_REQUEST_MB=25
EXPOSE 8080
