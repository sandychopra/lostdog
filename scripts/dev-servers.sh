#!/usr/bin/env bash
# Stops and (re)starts the backend (:4000) and frontend (:3000) dev servers.
#
#   scripts/dev-servers.sh [restart [--ngrok]|stop]    (default: restart)
#
# --ngrok also starts an ngrok tunnel to the frontend (if one isn't already
# running); see docs/post-pull-checklist.md for the env settings it needs.
# `stop` also stops that tunnel; `restart` leaves a running tunnel alone.
#
# Only processes *listening* on the ports are stopped. A plain `lsof -i :3000`
# also matches clients connected to it — e.g. an ngrok tunnel — and kills them.
set -euo pipefail

cd "$(dirname "$0")/.."

BACKEND_PORT=4000
FRONTEND_PORT=3000
NGROK_CMD="ngrok http $FRONTEND_PORT"

listener_pids() {
  lsof -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

stop_port() {
  local name=$1 port=$2 pids i
  pids=$(listener_pids "$port")
  if [ -z "$pids" ]; then
    echo "$name (:$port) not running"
    return
  fi
  # shellcheck disable=SC2086 # word-splitting the PID list is intended
  kill $pids 2>/dev/null || true
  for i in $(seq 1 25); do
    [ -z "$(listener_pids "$port")" ] && break
    sleep 0.2
  done
  pids=$(listener_pids "$port")
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
  echo "$name (:$port) stopped"
}

wait_for() {
  local name=$1 url=$2 log=$3 i
  for i in $(seq 1 40); do
    if curl -sf -o /dev/null "$url"; then
      echo "✓ $name up at $url"
      return 0
    fi
    sleep 0.5
  done
  echo "✗ $name did not respond at $url — last lines of $log:"
  tail -n 15 "$log" | sed 's/^/    /'
  return 1
}

stop_all() {
  stop_port backend "$BACKEND_PORT"
  stop_port frontend "$FRONTEND_PORT"
}

stop_ngrok() {
  if pkill -f "$NGROK_CMD"; then
    echo "ngrok stopped"
  else
    echo "ngrok not running"
  fi
}

start_ngrok() {
  local i url
  if ! command -v ngrok > /dev/null; then
    echo "✗ ngrok is not installed"
    return 1
  fi
  if ! pgrep -f "$NGROK_CMD" > /dev/null; then
    nohup $NGROK_CMD --log=stdout < /dev/null > ngrok.log 2>&1 &
  fi
  # The agent's local API (port 4040) reports the public URL once connected.
  for i in $(seq 1 20); do
    url=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -n 1 | cut -d'"' -f4 || true)
    if [ -n "$url" ]; then
      echo "✓ ngrok tunnel at $url"
      return 0
    fi
    sleep 0.5
  done
  echo "✗ ngrok did not connect — last lines of ngrok.log:"
  tail -n 15 ngrok.log | sed 's/^/    /'
  return 1
}

command=${1:-restart}
with_ngrok=false
if [ "${2:-}" = "--ngrok" ] || [ "$command" = "--ngrok" ]; then
  with_ngrok=true
  [ "$command" = "--ngrok" ] && command=restart
fi

case "$command" in
  stop)
    stop_all
    stop_ngrok
    ;;
  restart)
    stop_all
    nohup bun run dev:backend < /dev/null > backend.log 2>&1 &
    nohup bun run dev:frontend < /dev/null > frontend.log 2>&1 &
    status=0
    wait_for backend "http://localhost:$BACKEND_PORT/api/health" backend.log || status=1
    wait_for frontend "http://localhost:$FRONTEND_PORT" frontend.log || status=1
    if [ "$with_ngrok" = true ]; then
      start_ngrok || status=1
    fi
    echo "Logs: tail -f backend.log frontend.log"
    exit $status
    ;;
  *)
    echo "usage: $0 [restart [--ngrok]|stop]" >&2
    exit 2
    ;;
esac
