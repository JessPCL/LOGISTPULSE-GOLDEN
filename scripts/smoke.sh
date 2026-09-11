#!/usr/bin/env bash
set -euo pipefail
base_url="${ERP_PULSE_URL:-http://localhost:8000}"

curl --fail --silent "${base_url}/api/health"
curl --fail --silent "${base_url}/api/dashboard"
curl --fail --silent "${base_url}/api/orders/ORD-000001"
echo
echo "Smoke test aprobado"

