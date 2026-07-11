# Change: presigned-urls-minio

## Why
Pendência da nota-005: as saídas do batch no MinIO retornam `s3://bucket/chave` (opaco para o
consumidor) ou dependem de `publicBaseUrl` (bucket público). Presigned URLs dão download direto,
autenticado e com expiração — sem expor o bucket.

## What Changes
- A referência PERSISTIDA continua canônica (`s3://bucket/chave` — nunca expira no banco).
- A URL assinada é gerada NA CONSULTA (`GET /render/batch/{jobId}`): `linkDeDownload(referencia)`
  presigna GET com validade configurável (`REPORTLENZ_STORAGE_PRESIGN_HORAS`, default 24; 0 desliga
  e mantém o comportamento atual). Consulta repetida → URL fresca.
- Presigning é operação LOCAL (assinatura), sem ida à rede; provider LOCAL/publicBaseUrl passam
  intactos pelo mesmo método.

## Impact
- Affected specs: `saidas` (nova capability)
- Affected code: `render-service/storage` (S3Presigner), `BatchController.status`, application.yml.
- Fecha o trio de infra da nota-005 (registro ADR-009 ✓, compile cache Redis ✓, presigned ✓ —
  resta só Redis Streams/consumer groups, item separado).
