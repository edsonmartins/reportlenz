# Tasks — presigned-urls-minio

- [x] 1.1 S3Presigner no ArmazenamentoDeSaida + `linkDeDownload(referencia)` (presign local, path-style;
      passthrough p/ LOCAL/publicBaseUrl/desabilitado)
- [x] 1.2 `presign-horas` na config (env REPORTLENZ_STORAGE_PRESIGN_HORAS, default 24; 0 desliga) +
      BatchController.status assina na consulta
- [x] 1.3 Testes: URL assinada path-style com expiração · passthrough LOCAL/desligado · validação
      opt-in contra o MinIO real da infra
