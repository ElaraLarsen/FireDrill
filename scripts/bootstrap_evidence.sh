#!/usr/bin/env bash
# Create the FireDrill evidence remote: a bare git repo the fixer and breaker
# push to and only firedrill-gate may merge into main.
#
#   scripts/bootstrap_evidence.sh <incident-lab repo URL or path>
#
# Reads/writes .env in the repo root:
#   FIREDRILL_EVIDENCE_REMOTE  (default /tmp/firedrill/evidence.git)
#   FIREDRILL_KEYHASH_FILE     (default /tmp/firedrill/gate.keyhash)
#   FIREDRILL_GATE_KEY         generated here if empty; only the gate gets it
#
# Idempotent: re-running keeps an existing remote and key, and reinstalls the hook.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
env_file="${FIREDRILL_ENV_FILE:-$root/.env}"
lab="${1:-${FIREDRILL_LAB_REPO:-}}"

[ -f "$env_file" ] || cp "$root/.env.example" "$env_file"
getenv() { grep -E "^$1=" "$env_file" | tail -1 | cut -d= -f2- || true; }
setenv() {
  if grep -qE "^$1=" "$env_file"; then
    sed -i.bak "s|^$1=.*|$1=$2|" "$env_file" && rm -f "$env_file.bak"
  else
    printf '%s=%s\n' "$1" "$2" >> "$env_file"
  fi
}

remote="$(getenv FIREDRILL_EVIDENCE_REMOTE)"; remote="${remote:-/tmp/firedrill/evidence.git}"
keyhash="$(getenv FIREDRILL_KEYHASH_FILE)";   keyhash="${keyhash:-/tmp/firedrill/gate.keyhash}"
key="$(getenv FIREDRILL_GATE_KEY)"

if [ -z "$key" ]; then
  command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 1; }
  key="$(openssl rand -hex 32)"
  setenv FIREDRILL_GATE_KEY "$key"
  echo "generated FIREDRILL_GATE_KEY into .env"
fi
setenv FIREDRILL_EVIDENCE_REMOTE "$remote"
setenv FIREDRILL_KEYHASH_FILE "$keyhash"

mkdir -p "$(dirname "$keyhash")"
printf '%s' "$key" | sha256sum | cut -d' ' -f1 > "$keyhash"
chmod 644 "$keyhash"

if [ ! -d "$remote" ]; then
  [ -n "$lab" ] || { echo "usage: $0 <incident-lab repo URL or path>  (needed to seed main)" >&2; exit 1; }
  mkdir -p "$(dirname "$remote")"
  git init -q --bare -b main "$remote"
  seed="$(mktemp -d)"
  git clone -q "$lab" "$seed/lab"
  # Seed before the hook exists, so the first main needs no key.
  git -C "$seed/lab" push -q "$remote" HEAD:refs/heads/main
  rm -rf "$seed"
  echo "created $remote seeded from $lab"
else
  echo "kept existing $remote"
fi

git -C "$remote" config firedrill.keyhashfile "$keyhash"
git -C "$remote" config receive.denyDeletes false   # the hook decides
git -C "$remote" config receive.denyNonFastForwards false
install -m 755 "$root/scripts/hooks/update" "$remote/hooks/update"

echo "evidence remote ready: $remote"
echo "  main:  $(git -C "$remote" rev-parse --short main)"
echo "  hook:  $remote/hooks/update (main guarded by $keyhash)"
