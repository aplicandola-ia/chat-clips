#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f .env ]; then
  echo "Falta .env. Copia .env.example a .env y añade tus credenciales de Twitch."
  exit 2
fi
set -a
source ./.env
set +a
exec node discover-twitch.mjs "$@"
