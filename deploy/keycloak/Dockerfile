# Keycloak com o realm de homologação embutido (ADR-019 §4). Imagem própria em
# vez de bind mount: funciona em qualquer host Docker (pastas não compartilhadas,
# hosts remotos), e o realm vai junto com a versão do repositório.
FROM quay.io/keycloak/keycloak:26.4
COPY realm-reportlenz.json /opt/keycloak/data/import/realm-reportlenz.json
