#!/usr/bin/env bash
# ADR-018 §6: falha se algum teste do render-service foi PULADO (fixture ou
# MinIO ausente faziam testes sumirem do CI sem aviso). Lê os relatórios do
# surefire da última execução — de TODOS os módulos do backend (ADR-026).
set -euo pipefail
dir="${1:-render-service}"
relatorios=()
while IFS= read -r f; do relatorios+=("$f"); done < <(find "$dir" -path '*/target/surefire-reports/TEST-*.xml' 2>/dev/null | sort)
if [ ${#relatorios[@]} -eq 0 ]; then
  echo "::error::nenhum relatório do surefire em $dir"
  exit 1
fi
total=0
pulados=0
for f in "${relatorios[@]}"; do
  linha=$(grep -m1 -o '<testsuite [^>]*>' "$f")
  t=$(sed -E 's/.* tests="([0-9]+)".*/\1/' <<<"$linha")
  s=$(sed -E 's/.* skipped="([0-9]+)".*/\1/' <<<"$linha")
  total=$((total + t))
  if [ "$s" -gt 0 ]; then
    echo "::error::$(basename "$f" .xml | sed 's/^TEST-//'): $s teste(s) pulado(s)"
    pulados=$((pulados + s))
  fi
done
echo "testes: $total · pulados: $pulados"
[ "$pulados" -eq 0 ]
