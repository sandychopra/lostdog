#!/usr/bin/env bash
# Brings a local checkout up to date after a pull (or sets it up the first time):
# the steps in docs/post-pull-checklist.md, which explains each one.
#
#   scripts/post-pull.sh [--no-start] [--ngrok] [--env-only]    (bun run sync)
#
#   1. bun install
#   2. backend/.env and frontend/.env: create from .env.example if missing, fill in a
#      blank BETTER_AUTH_SECRET, and append any variable .env.example has that .env lacks
#   3. prisma migrate deploy   (never resets — see the checklist for a history mismatch)
#   4. prisma generate
#   5. bun run seed, only if the database has no users yet
#   6. restart the dev servers (scripts/dev-servers.sh); --no-start skips it,
#      --ngrok also starts the tunnel. --env-only runs step 2 alone.
#
# It does not create the Postgres role/database — see checklist step 4.
set -euo pipefail

cd "$(dirname "$0")/.."

start_servers=true
with_ngrok=false
env_only=false
for arg in "$@"; do
  case "$arg" in
    --no-start) start_servers=false ;;
    --ngrok) with_ngrok=true ;;
    --env-only) env_only=true ;;
    *)
      echo "usage: $0 [--no-start] [--ngrok] [--env-only]" >&2
      exit 2
      ;;
  esac
done

notes=""

step() {
  echo
  echo "── $1"
}

note() {
  notes="${notes}  • $1"$'\n'
}

var_names() {
  grep -oE '^[A-Z_]+=' "$1" | tr -d '=' || true
}

# Replaces a blank `NAME=` / `NAME=""` line in a file with `NAME="value"`.
fill_blank_var() {
  local file=$1 name=$2 value=$3 tmp
  tmp=$(mktemp)
  awk -v name="$name" -v value="$value" '
    $0 == name "=" || $0 == name "=\"\"" { print name "=\"" value "\""; next }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

sync_env() {
  local dir=$1 env="$1/.env" example="$1/.env.example" missing extra name line blank=""
  if [ ! -f "$example" ]; then
    echo "✗ $example not found"
    return 1
  fi

  if [ ! -f "$env" ]; then
    cp "$example" "$env"
    echo "✓ created $env from .env.example"
    note "Created $env from .env.example — review its values."
  fi

  if [ "$dir" = backend ] && grep -qE '^BETTER_AUTH_SECRET=("")?$' "$env"; then
    fill_blank_var "$env" BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
    echo "✓ generated BETTER_AUTH_SECRET in $env"
  fi

  missing=$(comm -23 <(var_names "$example" | sort -u) <(var_names "$env" | sort -u))
  extra=$(comm -13 <(var_names "$example" | sort -u) <(var_names "$env" | sort -u))

  if [ -n "$missing" ]; then
    {
      echo
      echo "# Added by bun run sync on $(date +%Y-%m-%d) from .env.example"
      for name in $missing; do
        grep -m 1 -E "^${name}=" "$example"
      done
    } >> "$env"
    for name in $missing; do
      line=$(grep -m 1 -E "^${name}=" "$example")
      echo "✓ added $name to $env"
      if [ "$line" = "${name}=" ] || [ "$line" = "${name}=\"\"" ]; then
        blank="${blank} ${name}"
      fi
    done
    if [ -n "$blank" ]; then
      note "Added blank to $env — fill in any you need (see the comments in .env.example):${blank}"
    fi
  else
    echo "✓ $env has every variable in .env.example"
  fi

  if [ -n "$extra" ]; then
    echo "  (not in .env.example, left alone: $(echo "$extra" | tr '\n' ' '))"
  fi
}

print_summary() {
  echo
  if [ -n "$notes" ]; then
    echo "Needs your attention:"
    printf '%s' "$notes"
  else
    echo "✓ Everything is in sync."
  fi
}

if [ "$env_only" = false ]; then
  step "1. Installing dependencies"
  bun install
fi

step "2. Checking environment files"
sync_env backend
sync_env frontend

if [ "$env_only" = true ]; then
  print_summary
  exit 0
fi

step "3. Applying database migrations"
if ! (cd backend && bunx prisma migrate deploy); then
  echo
  echo "✗ prisma migrate deploy failed. Common causes (docs/post-pull-checklist.md, step 4):"
  echo "    - Postgres isn't running, or the role/database in backend/.env's DATABASE_URL doesn't exist yet"
  echo "    - a migration-history mismatch on an old database — fix by hand with"
  echo "      'cd backend && bunx prisma migrate reset --force' (drops your local data)"
  exit 1
fi

step "4. Generating the Prisma client"
(cd backend && bunx prisma generate)

step "5. Seeding dev data if the database is empty"
user_count=$(cd backend && bun -e 'import { prisma } from "./src/lib/prisma.ts"; console.log(await prisma.user.count()); await prisma.$disconnect();')
if [ "$user_count" = 0 ]; then
  (cd backend && bun run seed)
  echo "✓ seeded dev data"
  note "Seeded dev data — sign in with SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD from backend/.env."
else
  echo "✓ database already has $user_count users — skipping seed"
fi

if [ "$start_servers" = true ]; then
  step "6. Restarting the dev servers"
  restart_args=(restart)
  [ "$with_ngrok" = true ] && restart_args+=(--ngrok)
  servers_status=0
  scripts/dev-servers.sh "${restart_args[@]}" || servers_status=$?
  print_summary
  exit "$servers_status"
fi

print_summary
echo "Dev servers not restarted (--no-start) — run 'bun run dev:restart' when you're ready."
