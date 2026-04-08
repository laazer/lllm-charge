#!/usr/bin/env bash
# LLM-Charge Local Deploy
# Build and run a stable local instance alongside active development.
#
# Usage:
#   ./scripts/local-deploy.sh start [--build]   Start (optionally rebuild first)
#   ./scripts/local-deploy.sh stop               Stop running instance
#   ./scripts/local-deploy.sh restart [--build]  Restart (optionally rebuild first)
#   ./scripts/local-deploy.sh status             Show running status
#   ./scripts/local-deploy.sh logs [backend|react] Tail logs (default: both)
#
# Ports (override via env):
#   BACKEND_PORT   Backend API server  (default: 3001)
#   REACT_PORT     React preview       (default: 4000)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_PORT="${BACKEND_PORT:-3001}"
REACT_PORT="${REACT_PORT:-4000}"

# Resolve project root regardless of where the script is called from
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.local-deploy"
BACKEND_PID="$RUN_DIR/backend.pid"
REACT_PID="$RUN_DIR/react.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
REACT_LOG="$RUN_DIR/react.log"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[llm-charge]${NC} $*"; }
success() { echo -e "${GREEN}[llm-charge]${NC} $*"; }
warn()    { echo -e "${YELLOW}[llm-charge]${NC} $*"; }
error()   { echo -e "${RED}[llm-charge]${NC} $*" >&2; }

pid_alive() {
  [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null
}

# True if something is listening on TCP port (macOS/Linux with lsof).
tcp_port_listening() {
  local p="$1"
  command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
}

# Drop pidfiles whose processes have exited (avoids "already running" when only one side is alive).
remove_stale_pidfile() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  if pid_alive "$f"; then
    return 0
  fi
  rm -f "$f"
}

# After crashes or manual kills, backend may be gone while vite preview keeps running (or vice versa).
# Normalize so we either have both running or a clean slate before start.
reconcile_local_deploy_pids() {
  remove_stale_pidfile "$BACKEND_PID"
  remove_stale_pidfile "$REACT_PID"

  local b_alive=false
  local r_alive=false
  pid_alive "$BACKEND_PID" && b_alive=true
  pid_alive "$REACT_PID" && r_alive=true

  if $b_alive && $r_alive; then
    return 1
  fi

  if $b_alive && ! $r_alive; then
    warn "Backend was running without this script's React preview — stopping backend for a clean start."
    stop_process "$BACKEND_PID" "backend"
  fi

  if ! $b_alive && $r_alive; then
    warn "React preview was still running after the backend exited — stopping orphaned preview."
    stop_process "$REACT_PID" "react"
  fi

  return 0
}

require_root() {
  if [[ ! -f "$ROOT/package.json" ]]; then
    error "package.json not found. Run from the project root or via npm run."
    exit 1
  fi
}

# ── Build ─────────────────────────────────────────────────────────────────────
build() {
  info "Building TypeScript backend..."
  cd "$ROOT"
  npm run build

  info "Building React frontend (production)..."
  # Embed backend WS port; change BACKEND_PORT after build requires rebuild.
  VITE_BACKEND_PORT="${BACKEND_PORT:-3001}" npm run build:react

  success "Build complete."
}

# ── Start ─────────────────────────────────────────────────────────────────────
start() {
  require_root
  local do_build=false
  [[ "${1:-}" == "--build" ]] && do_build=true

  mkdir -p "$RUN_DIR"

  if ! reconcile_local_deploy_pids; then
    warn "Instance already running. Use ${YELLOW}npm run local:restart${NC} or ${YELLOW}npm run local:stop${NC} first."
    status
    exit 1
  fi

  $do_build && build

  # Verify dist exists
  if [[ ! -d "$ROOT/dist/react" ]]; then
    warn "dist/react not found — running build first..."
    build
  fi

  cd "$ROOT"

  if tcp_port_listening "$BACKEND_PORT"; then
    error "Port $BACKEND_PORT is already in use — another process is listening (common: npm run dev:server or an old node)."
    info "Free the port:  ${CYAN}kill \$(lsof -ti :$BACKEND_PORT)${NC}"
    info "Or use another:   ${CYAN}BACKEND_PORT=3002 npm run local${NC}"
    exit 1
  fi

  # Start backend
  info "Starting backend on port $BACKEND_PORT..."
  LLM_CHARGE_ROOT="$ROOT" PORT="$BACKEND_PORT" node src/server/comprehensive-working-server.mjs \
    >> "$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID"

  # Brief grace: Node can exit quickly on error; give slow DB init a few seconds.
  sleep 2
  if ! pid_alive "$BACKEND_PID"; then
    sleep 3
  fi
  if ! pid_alive "$BACKEND_PID"; then
    error "Backend exited during startup. Recent log:"
    echo -e "${YELLOW}────────────────────────────────${NC}"
    tail -n 30 "$BACKEND_LOG" 2>/dev/null || true
    echo -e "${YELLOW}────────────────────────────────${NC}"
    info "Full log: $BACKEND_LOG"
    if tcp_port_listening "$BACKEND_PORT"; then
      info "Port $BACKEND_PORT is in use — ${CYAN}kill \$(lsof -ti :$BACKEND_PORT)${NC} or set ${CYAN}BACKEND_PORT${NC}."
    fi
    rm -f "$BACKEND_PID"
    exit 1
  fi

  # Start React preview (/api proxy must match BACKEND_PORT)
  info "Starting React preview on port $REACT_PORT..."
  BACKEND_URL="http://127.0.0.1:$BACKEND_PORT" npx vite preview --port "$REACT_PORT" --host \
    >> "$REACT_LOG" 2>&1 &
  echo $! > "$REACT_PID"

  sleep 1
  if ! pid_alive "$REACT_PID"; then
    error "React preview failed to start. Check logs: $REACT_LOG"
    stop_process "$BACKEND_PID" "backend"
    exit 1
  fi

  success "LLM-Charge running:"
  echo -e "  ${CYAN}React dashboard${NC}  →  http://localhost:$REACT_PORT"
  echo -e "  ${CYAN}Backend API${NC}       →  http://localhost:$BACKEND_PORT"
  echo -e "  ${CYAN}Legacy dashboard${NC}  →  http://localhost:$BACKEND_PORT/interactive-dashboard.html"
  echo ""
  echo -e "  Logs: ${YELLOW}$RUN_DIR/${NC}"
  echo -e "  Stop: ${YELLOW}npm run local:stop${NC}"
}

# ── Stop ──────────────────────────────────────────────────────────────────────
stop_process() {
  local pidfile="$1" name="$2"
  if pid_alive "$pidfile"; then
    kill "$(cat "$pidfile")" 2>/dev/null && success "Stopped $name."
  else
    warn "$name was not running."
  fi
  rm -f "$pidfile"
}

stop() {
  stop_process "$BACKEND_PID" "backend"
  stop_process "$REACT_PID"   "react"
}

# ── Restart ───────────────────────────────────────────────────────────────────
restart() {
  stop
  sleep 1
  start "${1:-}"
}

# ── Status ────────────────────────────────────────────────────────────────────
status() {
  remove_stale_pidfile "$BACKEND_PID"
  remove_stale_pidfile "$REACT_PID"
  echo ""
  echo -e "${BLUE}LLM-Charge Local Deploy Status${NC}"
  echo "──────────────────────────────"

  if pid_alive "$BACKEND_PID"; then
    echo -e "  Backend   ${GREEN}running${NC}  (PID $(cat "$BACKEND_PID"))  →  http://localhost:$BACKEND_PORT"
  else
    echo -e "  Backend   ${RED}stopped${NC}"
  fi

  if pid_alive "$REACT_PID"; then
    echo -e "  React     ${GREEN}running${NC}  (PID $(cat "$REACT_PID"))  →  http://localhost:$REACT_PORT"
  else
    echo -e "  React     ${RED}stopped${NC}"
  fi
  echo ""
}

# ── Logs ──────────────────────────────────────────────────────────────────────
logs() {
  local target="${1:-both}"
  case "$target" in
    backend) tail -f "$BACKEND_LOG" ;;
    react)   tail -f "$REACT_LOG" ;;
    *)
      # Interleave both logs with labels
      tail -f "$BACKEND_LOG" "$REACT_LOG" ;;
  esac
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
CMD="${1:-help}"
shift || true

case "$CMD" in
  start)   start   "${1:-}" ;;
  stop)    stop ;;
  restart) restart "${1:-}" ;;
  status)  status ;;
  logs)    logs    "${1:-}" ;;
  build)   build ;;
  *)
    echo "Usage: $(basename "$0") {start [--build] | stop | restart [--build] | status | logs [backend|react] | build}"
    exit 1
    ;;
esac
