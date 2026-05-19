#!/bin/zsh
set -euo pipefail

# Generate a secure VC_AUTOGRADE_TOKEN and distribute it to GitHub repo secrets.
#
# Usage:
#   scripts/generate_and_distribute_autograde_token.sh --dry-run <csv_path>
#   scripts/generate_and_distribute_autograde_token.sh --apply <csv_path>
#
# CSV header:
#   repo,unit_id,user_id,candidate_count,selected_status
#   (only first column "repo" is required by this script)
#
# Optional:
#   --token-file=/secure/path/token.txt   # reuse existing token instead of generating new
#   --out=/secure/path/new_token.txt      # where to store generated token (default: /tmp/...)

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --apply|--dry-run <csv_path> [--token-file=...] [--out=...]"
  exit 1
fi

MODE="$1"
CSV="$2"
TOKEN_FILE=""
OUT_FILE=""
GH=/opt/homebrew/bin/gh
REPORT="/tmp/distribute_autograde_token_$(date +%Y%m%d_%H%M%S).csv"

for arg in "$@"; do
  case "$arg" in
    --token-file=*)
      TOKEN_FILE="${arg#*=}"
      ;;
    --out=*)
      OUT_FILE="${arg#*=}"
      ;;
  esac
done

if [[ "$MODE" != "--apply" && "$MODE" != "--dry-run" ]]; then
  echo "First arg must be --apply or --dry-run"
  exit 1
fi

if [[ ! -f "$CSV" ]]; then
  echo "CSV not found: $CSV"
  exit 1
fi

token=""
if [[ -n "$TOKEN_FILE" ]]; then
  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo "token file not found: $TOKEN_FILE"
    exit 1
  fi
  token="$(tr -d '\r\n' < "$TOKEN_FILE")"
else
  token="$(openssl rand -hex 32)"
fi

if [[ -z "$token" ]]; then
  echo "failed to load/generate token"
  exit 1
fi

if [[ -z "$OUT_FILE" ]]; then
  OUT_FILE="/tmp/vc_autograde_token_$(date +%Y%m%d_%H%M%S).txt"
fi

umask 077
printf '%s' "$token" > "$OUT_FILE"
chmod 600 "$OUT_FILE"

echo "repo,result,detail" > "$REPORT"

tail -n +2 "$CSV" | while IFS=, read -r repo _rest; do
  repo="${repo//$'\r'/}"
  [[ -z "$repo" ]] && continue

  if [[ "$MODE" == "--dry-run" ]]; then
    echo "${repo},dry-run,would_set_VC_AUTOGRADE_TOKEN" >> "$REPORT"
    continue
  fi

  if printf '%s' "$token" | $GH secret set VC_AUTOGRADE_TOKEN --repo "$repo" >/dev/null 2>&1; then
    echo "${repo},updated,ok" >> "$REPORT"
  else
    echo "${repo},failed,set_secret_failed" >> "$REPORT"
  fi
done

echo "[DONE] report: $REPORT"
echo "[DONE] token_file: $OUT_FILE"
echo "[NOTE] token file permission is 600. Keep it secure and avoid committing it."
