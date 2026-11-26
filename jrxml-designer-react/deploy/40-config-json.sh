#!/bin/sh
# Gera /config.json da SPA a partir do ambiente (ADR-017 §6 / ADR-019 §1).
# OIDC_AUTHORITY vazio = modo dev (sem login) — casa com
# REPORTLENZ_SEGURANCA_HABILITADA=false no render-service.
set -eu
destino=/usr/share/nginx/html/config.json
if [ -n "${OIDC_AUTHORITY:-}" ]; then
  printf '{"oidc":{"authority":"%s","clientId":"%s"}}\n' "$OIDC_AUTHORITY" "${OIDC_CLIENT_ID:-reportlenz}" > "$destino"
  echo "[config.json] OIDC: $OIDC_AUTHORITY (client ${OIDC_CLIENT_ID:-reportlenz})"
else
  printf '{"oidc":null}\n' > "$destino"
  echo "[config.json] ATENÇÃO: sem OIDC_AUTHORITY — SPA em modo dev (sem login)"
fi
