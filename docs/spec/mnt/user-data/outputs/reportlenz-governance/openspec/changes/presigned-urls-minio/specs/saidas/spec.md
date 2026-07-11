# Spec: saidas (capability) — download de saídas do batch

## ADDED Requirements

### Requirement: URL assinada gerada na consulta
Com MinIO ativo e presign habilitado, o status do job SHALL devolver URLs pré-assinadas (GET, validade
configurável) geradas no momento da consulta; a referência persistida permanece `s3://bucket/chave`.

#### Scenario: Download direto com expiração
- **WHEN** o cliente consulta `GET /render/batch/{jobId}` de um lote gravado no MinIO
- **THEN** cada saída vem como URL assinada (path-style, `X-Amz-Signature`, expiração) — não `s3://`

#### Scenario: Consulta repetida renova a URL
- **WHEN** o mesmo job é consultado após a expiração da URL anterior
- **THEN** a nova consulta devolve URL válida (assinatura fresca)

### Requirement: Passthrough fora do MinIO
Saídas LOCAL, referências `publicBaseUrl` e presign desabilitado (`presign-horas: 0`) SHALL passar
inalteradas.

#### Scenario: Provider LOCAL
- **WHEN** o storage é LOCAL
- **THEN** a referência devolvida no status é o caminho/URL de sempre, sem assinatura
