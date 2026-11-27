#!/usr/bin/env bash
# Empacota os dois pacotes do monorepo (pnpm pack — o mesmo conteúdo que iria
# ao npm) e instala esta aplicação a partir dos tarballs, com npm, como uma
# aplicação da empresa instalaria. Depois: npm run preview (porta 5300).
set -euo pipefail
cd "$(dirname "$0")"
RAIZ=$(cd ../.. && pwd)
rm -rf pacotes node_modules package-lock.json dist
mkdir -p pacotes
pnpm --dir "$RAIZ/jrxml-core" build
pnpm --dir "$RAIZ/jrxml-designer-react" build:lib
(cd "$RAIZ/jrxml-core" && pnpm pack --pack-destination "$RAIZ/exemplos/host-react/pacotes" >/dev/null)
(cd "$RAIZ/jrxml-designer-react" && pnpm pack --pack-destination "$RAIZ/exemplos/host-react/pacotes" >/dev/null)
npm install --no-audit --no-fund
npm run build
