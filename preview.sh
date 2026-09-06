#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
ASTRA_RUNTIME="$(cd ../runtime && pwd)"
if ! pg_ctl -D "$ASTRA_RUNTIME/postgres" status >/dev/null 2>&1; then
  pg_ctl -D "$ASTRA_RUNTIME/postgres" -l "$ASTRA_RUNTIME/postgres.log" -o "-h 127.0.0.1 -p 55431 -k $ASTRA_RUNTIME" start
fi
export PORT=3101
npm run dev -- --hostname 0.0.0.0 --port "$PORT" 2>&1 | tee -a "$ASTRA_RUNTIME/option-1.log"
