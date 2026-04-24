#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"
shift || true

if [ "$#" -gt 0 ]; then
  START_CMD=("$@")
else
  START_CMD=(npm run dev)
fi

echo "Checking port ${PORT}..."
PIDS="$(lsof -ti tcp:"${PORT}" -sTCP:LISTEN || true)"

if [ -n "${PIDS}" ]; then
  echo "Stopping process(es) on :${PORT}: ${PIDS}"
  # shellcheck disable=SC2086
  kill ${PIDS}
  sleep 1
else
  echo "No listening process on :${PORT}."
fi

echo "Starting: ${START_CMD[*]}"
exec "${START_CMD[@]}"
