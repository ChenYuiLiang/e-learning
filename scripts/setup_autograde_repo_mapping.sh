#!/bin/zsh
set -euo pipefail

# Batch configure per-repo unit-level mapping variables for autograde sync.
# CSV format:
# repo,unit_id,user_id
# vibe-coding-classroom/vibe-coding-classroom-xx,01-unit-developer-identity.html,uid_xxx

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --apply|--dry-run <csv_path>"
  exit 1
fi

MODE="$1"
CSV="$2"
GH=/opt/homebrew/bin/gh
OUT="/tmp/autograde_repo_mapping_$(date +%Y%m%d_%H%M%S).csv"

if [[ "$MODE" != "--apply" && "$MODE" != "--dry-run" ]]; then
  echo "First arg must be --apply or --dry-run"
  exit 1
fi

if [[ ! -f "$CSV" ]]; then
  echo "CSV not found: $CSV"
  exit 1
fi

echo "repo,result,detail" > "$OUT"

set_var() {
  local repo="$1"
  local name="$2"
  local value="$3"

  if [[ -z "$value" ]]; then
    return 0
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    echo "dryrun:${name}=${value}"
    return 0
  fi

  if $GH api "repos/${repo}/actions/variables/${name}" -X PATCH -f name="$name" -f value="$value" >/dev/null 2>&1; then
    return 0
  fi

  $GH api "repos/${repo}/actions/variables" -X POST -f name="$name" -f value="$value" >/dev/null 2>&1
}

tail -n +2 "$CSV" | while IFS=, read -r repo unit_id user_id _rest; do
  repo="${repo//$'\r'/}"
  unit_id="${unit_id//$'\r'/}"
  user_id="${user_id//$'\r'/}"

  if [[ -z "$repo" ]]; then
    continue
  fi

  if [[ -z "$unit_id" || -z "$user_id" ]]; then
    echo "${repo},skip,missing_mapping" >> "$OUT"
    continue
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    set_var "$repo" "VC_USER_ID" "$user_id" >/dev/null
    set_var "$repo" "VC_UNIT_ID" "$unit_id" >/dev/null
    echo "${repo},dry-run,ok" >> "$OUT"
    continue
  fi

  if set_var "$repo" "VC_USER_ID" "$user_id" \
    && set_var "$repo" "VC_UNIT_ID" "$unit_id"; then
    echo "${repo},updated,ok" >> "$OUT"
  else
    echo "${repo},failed,variable_update_failed" >> "$OUT"
  fi
done

echo "[DONE] $OUT"
