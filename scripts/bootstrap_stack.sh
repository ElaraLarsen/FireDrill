#!/usr/bin/env bash
# Bring up a local Switch server with Mattermost and the Gateway.
#
#   scripts/bootstrap_stack.sh          start (or keep) the stack
#   scripts/bootstrap_stack.sh down     stop it (volumes kept)
#
# Uses Switch's own published standalone compose file, pinned to the release
# in SWITCH_VERSION (default 0.31.0), fetched from the tagged source. Secrets
# are generated into .env the same way Switch's generate-env-secrets.sh does.
# Needs: docker with compose v2, curl, openssl.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
env_file="${FIREDRILL_ENV_FILE:-$root/.env}"
stack_dir="$root/.switch-stack"
compose="$stack_dir/standalone-docker-compose.yml"

[ -f "$env_file" ] || cp "$root/.env.example" "$env_file"
getenv() { grep -E "^$1=" "$env_file" | tail -1 | cut -d= -f2- || true; }
setenv() {
  if grep -qE "^$1=" "$env_file"; then
    sed -i.bak "s|^$1=.*|$1=$2|" "$env_file" && rm -f "$env_file.bak"
  else
    printf '%s=%s\n' "$1" "$2" >> "$env_file"
  fi
}

version="$(getenv SWITCH_VERSION)"; version="${version:-0.31.0}"
setenv SWITCH_VERSION "$version"
dc() { docker compose --env-file "$env_file" -f "$compose" --profile collab --profile gateway "$@"; }

if [ "${1:-}" = "down" ]; then
  dc down
  exit 0
fi

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose v2 is required" >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }

mkdir -p "$stack_dir"
if [ ! -f "$compose" ] || ! grep -q "switch-v$version" "$stack_dir/.source" 2>/dev/null; then
  url="https://raw.githubusercontent.com/sandbox-quantum/switch/switch-v$version/deploy/local/standalone-docker-compose.yml"
  echo "fetching Switch $version standalone compose"
  curl -fsSL "$url" -o "$compose"
  echo "switch-v$version $url" > "$stack_dir/.source"
fi

# Secrets: the same keys Switch's deploy/local/generate-env-secrets.sh fills.
for key in DB_PASSWORD DB_OWNER_PASSWORD AGENT_REGISTRATION_TOKEN GATEWAY_ADMIN_PASSWORD \
           MATTERMOST_ADMIN_PASSWORD MATTERMOST_USER_PASSWORD; do
  [ -n "$(getenv "$key")" ] || setenv "$key" "$(openssl rand -hex 24)"
done
[ -n "$(getenv SECRET_KEYS)" ] || setenv SECRET_KEYS "firedrill:$(openssl rand -hex 32)"
[ -n "$(getenv JWT_SECRET_KEY)" ] || setenv JWT_SECRET_KEY "$(openssl rand -hex 32)"

dc pull --quiet
dc up -d

api_port="$(getenv API_HOST_PORT)"; api_port="${api_port:-8000}"
echo -n "waiting for http://localhost:$api_port/health "
for _ in $(seq 1 90); do
  if curl -fsS "http://localhost:$api_port/health" >/dev/null 2>&1; then
    echo "ok"
    break
  fi
  echo -n "."; sleep 2
done
curl -fsS "http://localhost:$api_port/health" >/dev/null || { echo; echo "Switch did not become healthy; see: docker compose -f $compose logs switch" >&2; exit 1; }

gw="$(getenv GATEWAY_HOST_PORT)"; mm="$(getenv MATTERMOST_HOST_PORT)"
cat <<EOF

Switch $version is up.
  Switch API  http://localhost:$api_port   (SWITCH_URL for the gate)
  Gateway     http://localhost:${gw:-3000}   admin: $(getenv GATEWAY_ADMIN_EMAIL) / password in .env (GATEWAY_ADMIN_PASSWORD)
  Mattermost  http://localhost:${mm:-8065}   user: $(getenv MATTERMOST_USER) / password in .env (MATTERMOST_USER_PASSWORD)

Next:
  1. Switch Console -> add server http://localhost:$api_port, sign in to Claude Code and Codex.
  2. Gateway -> API Keys -> new key; put it in .env as FIREDRILL_REGISTRATION_TOKEN.
  3. python scripts/register_gate.py
  4. scripts/bootstrap_evidence.sh <incident-lab repo URL or path>
EOF
