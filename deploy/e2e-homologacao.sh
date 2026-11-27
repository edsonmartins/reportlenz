#!/usr/bin/env bash
# E2E do ambiente de homologação (change empacotamento-deploy/3.1, ADR-019) com
# tokens REAIS do Keycloak. Cria usuários/client TEMPORÁRIOS (e2e.*) e os
# remove no fim — os usuários de homologação não são tocados.
#   deploy/e2e-homologacao.sh deploy/.env
set -euo pipefail
ENV_FILE="${1:-deploy/.env}"
set -a; . "$ENV_FILE"; set +a
DC="docker compose -f $(dirname "$0")/docker-compose.homologacao.yml --env-file $ENV_FILE"
API="${DESIGNER_URL:-http://localhost:8080}"
KC="${KEYCLOAK_URL_PUBLICA:-http://localhost:8180}"
REALM=reportlenz
SENHA_E2E="e2e-$(date +%s)-Aa1!"
falhas=0
ok()   { echo "  ✓ $*"; }
erro() { echo "  ✗ $*"; falhas=$((falhas + 1)); }
espera() { # espera <descricao> <esperado> <obtido>
  if [ "$2" = "$3" ]; then ok "$1 ($3)"; else erro "$1: esperado $2, obtido $3"; fi
}

kcadm() { $DC exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"; }

limpar() {
  echo "== limpeza (usuários/client temporários)"
  for u in e2e.designer e2e.publicador; do
    # exact=true: sem ele a busca é por PREFIXO e casa também e2e.designer.<sufixo>
    # (identidades do Playwright) — o delete recebia 2 ids e falhava em silêncio.
    id=$(kcadm get users -r $REALM -q username=$u -q exact=true --fields id --format csv --noquotes 2>/dev/null || true)
    [ -n "$id" ] && kcadm delete users/$id -r $REALM >/dev/null 2>&1 || true
  done
  cid=$(kcadm get clients -r $REALM -q clientId=reportlenz-e2e --fields id --format csv --noquotes 2>/dev/null || true)
  [ -n "$cid" ] && kcadm delete clients/$cid -r $REALM >/dev/null 2>&1 || true
}
trap limpar EXIT

echo "== preparo (Keycloak admin)"
kcadm config credentials --server http://localhost:8080 --realm master \
  --user "$KEYCLOAK_ADMIN_USER" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null
limpar >/dev/null  # sobras de uma execução interrompida não quebram esta
kcadm create clients -r $REALM -s clientId=reportlenz-e2e -s publicClient=false \
  -s secret=e2e-segredo -s directAccessGrantsEnabled=true -s standardFlowEnabled=false >/dev/null
for par in "e2e.designer:reportlenz-designer" "e2e.publicador:reportlenz-designer,reportlenz-publicador"; do
  u=${par%%:*}; papeis=${par#*:}
  kcadm create users -r $REALM -s username=$u -s enabled=true -s emailVerified=true \
    -s email=$u@reportlenz.invalid -s firstName=E2E -s lastName=Teste >/dev/null
  kcadm set-password -r $REALM --username $u --new-password "$SENHA_E2E" >/dev/null
  for p in ${papeis//,/ }; do kcadm add-roles -r $REALM --uusername $u --rolename $p >/dev/null; done
done

token_usuario() {
  curl -sf -d grant_type=password -d client_id=reportlenz-e2e -d client_secret=e2e-segredo \
    -d username="$1" -d password="$SENHA_E2E" -d scope=openid \
    "$KC/realms/$REALM/protocol/openid-connect/token" | jq -r .access_token
}
T_DES=$(token_usuario e2e.designer)
T_PUB=$(token_usuario e2e.publicador)
T_BAT=$(curl -sf -d grant_type=client_credentials -d client_id=reportlenz-batch \
  -d client_secret="$REPORTLENZ_BATCH_CLIENT_SECRET" \
  "$KC/realms/$REALM/protocol/openid-connect/token" | jq -r .access_token)
[ -n "$T_DES" ] && [ -n "$T_PUB" ] && [ -n "$T_BAT" ] && ok "tokens reais obtidos (designer, publicador, service account)"

JRXML='<?xml version="1.0" encoding="UTF-8"?>
<jasperReport name="e2e" pageWidth="595" pageHeight="842" columnWidth="555" leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
	<field name="nome" class="java.lang.String"/>
	<title height="30">
		<element kind="textField" x="0" y="0" width="555" height="20">
			<expression><![CDATA["Olá, " + $F{nome} + " — R$ 1.234,56 ação"]]></expression>
		</element>
	</title>
</jasperReport>'
SCHEMA='{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["nome"],"properties":{"nome":{"type":"string"}}}'
CODENAME="e2e_$(date +%s)"
corpo_preview() { jq -n --arg j "$1" '{jrxml:$j, sampleData:{nome:"Ana"}, format:"pdf"}'; }
http() { # http <método> <url> <token|-> [corpo] → imprime status; corpo em /tmp-like var RESP
  local metodo=$1 url=$2 tok=$3 dados=${4:-}
  local args=(-s -o "$SAIDA" -w '%{http_code}' -X "$metodo" "$url" -H 'Content-Type: application/json')
  [ "$tok" != "-" ] && args+=(-H "Authorization: Bearer $tok")
  [ -n "$dados" ] && args+=(--data-binary "$dados")
  curl "${args[@]}"
}
SAIDA=$(mktemp)

echo "== autenticação e papéis (via designer/nginx em $API)"
espera "preview sem token → 401" 401 "$(http POST "$API/render/preview" - "$(corpo_preview "$JRXML")")"
espera "preview como designer → 200" 200 "$(http POST "$API/render/preview" "$T_DES" "$(corpo_preview "$JRXML")")"
head -c 5 "$SAIDA" | grep -q '%PDF-' && ok "preview devolve PDF" || erro "preview não devolveu PDF"
espera "preview como service account → 403" 403 "$(http POST "$API/render/preview" "$T_BAT" "$(corpo_preview "$JRXML")")"
# Adultera o 1º caractere da ASSINATURA (6 bits inteiros). Trocar o último era
# inócuo em ~25% dos tokens: em RS256/base64url seus 4 bits finais são ignorados.
SIG=${T_DES##*.}
[ "${SIG:0:1}" = A ] && TROCA=B || TROCA=A
T_ADULTERADO="${T_DES%.*}.${TROCA}${SIG:1}"
[ "$T_ADULTERADO" != "$T_DES" ] || erro "adulteração não alterou o token"
espera "token adulterado → 401" 401 "$(http POST "$API/render/preview" "$T_ADULTERADO" "$(corpo_preview "$JRXML")")"

echo "== segurança de expressão (G7)"
RCE=${JRXML/'"Olá, " + $F{nome} + " — R$ 1.234,56 ação"'/'Runtime.getRuntime().exec("id").toString()'}
espera "preview com Runtime.exec → 400" 400 "$(http POST "$API/render/preview" "$T_DES" "$(corpo_preview "$RCE")")"
espera "código EXPRESSAO_PROIBIDA" EXPRESSAO_PROIBIDA "$(jq -r .codigo "$SAIDA")"

echo "== ciclo do template"
espera "salvar draft como designer → 200" 200 "$(http POST "$API/templates/$CODENAME/versoes" "$T_DES" "$(jq -n --arg j "$JRXML" --argjson s "$SCHEMA" '{jrxml:$j, inputSchema:$s, actor:"diretor-forjado"}')")"
espera "publicar como designer → 403" 403 "$(http POST "$API/templates/$CODENAME/versoes/1/publicar" "$T_DES" '{}')"
espera "publicar como publicador → 200" 200 "$(http POST "$API/templates/$CODENAME/versoes/1/publicar" "$T_PUB" '{"actor":"diretor-forjado"}')"

echo "== lote"
LOTE=$(jq -n --arg c "$CODENAME" '{templateCodename:$c, payloads:[{nome:"Ana"},{nome:"Bento"}], idempotencyKey:("e2e-"+$c)}')
espera "lote como designer → 403" 403 "$(http POST "$API/render/batch" "$T_DES" "$LOTE")"
espera "lote com jrxml bruto → 400" 400 "$(http POST "$API/render/batch" "$T_BAT" "$(jq -n --arg j "$JRXML" '{jrxml:$j, payloads:[{nome:"x"}], idempotencyKey:"e2e-bruto"}')")"
espera "lote como service account → 202" 202 "$(http POST "$API/render/batch" "$T_BAT" "$LOTE")"
JOB=$(jq -r .jobId "$SAIDA")
st=""
for i in $(seq 1 60); do
  http GET "$API/render/batch/$JOB" "$T_BAT" >/dev/null
  st=$(jq -r .status "$SAIDA"); [ "$st" = "done" ] && break; sleep 1
done
espera "lote concluído" done "$st"
espera "2 saídas" 2 "$(jq -r '.outputs | length' "$SAIDA")"
jq -r '.outputs[0]' "$SAIDA" | grep -q 'X-Amz-Signature' && ok "saída no S3 com URL pré-assinada" || erro "saída sem URL pré-assinada: $(jq -r '.outputs[0]' "$SAIDA")"

echo "== auditoria e LGPD (banco)"
psqlq() { $DC exec -T postgres psql -U "$POSTGRES_USER" -d reportlenz -tAc "$1"; }
atores=$(psqlq "SELECT a.action || '=' || a.actor FROM report_template_audit a JOIN report_template_version v ON v.id=a.version_id JOIN report_template t ON t.id=v.template_id WHERE t.codename='$CODENAME' ORDER BY a.at" | tr '\n' ' ')
echo "    auditoria: $atores"
echo "$atores" | grep -q "created=e2e.designer" && ok "draft auditado com o designer do token" || erro "ator do draft"
echo "$atores" | grep -q "published=e2e.publicador" && ok "publish auditado com o publicador do token (corpo ignorado)" || erro "ator do publish"
echo "$atores" | grep -q "rendered_batch=service-account-reportlenz-batch" && ok "lote auditado com o service account" || erro "ator do lote"
echo "$atores" | grep -q "diretor-forjado" && erro "ator forjado aceito" || ok "nenhum ator forjado"
espera "payloads zerados após o lote" '[]' "$(psqlq "SELECT payloads FROM render_job WHERE id='$JOB'")"
espera "Flyway V1+V2 aplicadas (tabela própria, ADR-026)" "1,2" "$(psqlq "SELECT string_agg(version, ',' ORDER BY installed_rank) FROM reportlenz_schema_history WHERE success AND version <> '0'")"

echo "== superfície exposta"
curl -s "$API/actuator/prometheus" | grep -q 'jvm_' && erro "métricas expostas pelo designer" || ok "actuator não alcançável pelo designer"
espera "corpo de 30 MB → 413" 413 "$(head -c 31457280 /dev/zero | tr '\0' 'a' | curl -s -o /dev/null -w '%{http_code}' -X POST "$API/render/preview" -H "Authorization: Bearer $T_DES" -H 'Content-Type: application/json' --data-binary @-)"
espera "SPA com OIDC" "$KC/realms/$REALM" "$(curl -s "$API/config.json" | jq -r .oidc.authority)"
espera "render-service saudável (management interno)" healthy "$($DC ps --format '{{.Health}}' render-service)"

rm -f "$SAIDA"
echo
if [ "$falhas" -eq 0 ]; then echo "E2E OK"; else echo "E2E com $falhas falha(s)"; exit 1; fi
