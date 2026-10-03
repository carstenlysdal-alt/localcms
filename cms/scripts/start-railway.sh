#!/bin/sh
set -e

# Kør eventuelle Postgres-migrationer
node scripts/db-provider.mjs migrate

# Erstat shell-processen med next start via exec, så Next.js modtager SIGTERM direkte og lukker pænt ned
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
