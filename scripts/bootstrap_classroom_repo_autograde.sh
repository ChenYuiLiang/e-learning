#!/usr/bin/env bash
set -euo pipefail

# Bootstrap autograde settings for newly created classroom repos.
#
# What it does per repo:
# 1) Install unit-specific autograde workflow template
# 2) Set required Variables:
#    - VC_USER_ID + VC_UNIT_ID
# 3) Optionally set required Secrets:
#    - VC_AUTOGRADE_URL
#    - VC_AUTOGRADE_TOKEN
#
# Usage:
#   scripts/bootstrap_classroom_repo_autograde.sh --dry-run <csv_path>
#   scripts/bootstrap_classroom_repo_autograde.sh --apply   <csv_path>
#
# Optional env vars (for per-repo secret write):
#   VC_AUTOGRADE_URL_VALUE="https://.../ingestGithubAutograde"
#   VC_AUTOGRADE_TOKEN_VALUE="your_token"
#
# CSV format (header required):
# repo,unit_id,user_id
# vibe-coding-classroom/repo-a,03-unit-github-classroom,uid123
# vibe-coding-classroom/repo-b,start-01-unit-html5-basics,uid456

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --apply|--dry-run <csv_path>"
  exit 1
fi

MODE="$1"
CSV="$2"
GH="${GH_BIN:-gh}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_DIR="$ROOT_DIR/scripts/workflow-templates"
OUT="/tmp/bootstrap_classroom_repo_autograde_$(date +%Y%m%d_%H%M%S).csv"

if [[ "$MODE" != "--apply" && "$MODE" != "--dry-run" ]]; then
  echo "First arg must be --apply or --dry-run"
  exit 1
fi

if [[ ! -f "$CSV" ]]; then
  echo "CSV not found: $CSV"
  exit 1
fi

echo "repo,unit_id,workflow,variables,secrets,result,detail" > "$OUT"

has_secret() {
  local repo="$1"
  local name="$2"
  $GH api "repos/${repo}/actions/secrets/${name}" >/dev/null 2>&1
}

set_var() {
  local repo="$1"
  local name="$2"
  local value="$3"
  [[ -z "$value" ]] && return 0

  if [[ "$MODE" == "--dry-run" ]]; then
    return 0
  fi

  if $GH api "repos/${repo}/actions/variables/${name}" -X PATCH -f name="$name" -f value="$value" >/dev/null 2>&1; then
    return 0
  fi
  $GH api "repos/${repo}/actions/variables" -X POST -f name="$name" -f value="$value" >/dev/null 2>&1
}

set_secret() {
  local repo="$1"
  local name="$2"
  local value="$3"
  [[ -z "$value" ]] && return 1

  if [[ "$MODE" == "--dry-run" ]]; then
    return 0
  fi

  printf '%s' "$value" | $GH secret set "$name" --repo "$repo" >/dev/null
}

install_workflow_template() {
  local repo="$1"
  local unit_id="$2"
  local selected="$TEMPLATE_DIR/default.yml"
  local unit_tpl="$TEMPLATE_DIR/${unit_id}.yml"
  if [[ -n "$unit_id" && -f "$unit_tpl" ]]; then
    selected="$unit_tpl"
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    echo "dry-run:${selected}"
    return 0
  fi

  local repo_dir="/tmp/bootstrap-$(echo "$repo" | tr '/' '-')"
  local prev_dir
  prev_dir="$(pwd)"
  local clone_url="https://github.com/${repo}.git"
  if [[ -n "${GH_TOKEN:-}" ]]; then
    clone_url="https://x-access-token:${GH_TOKEN}@github.com/${repo}.git"
  fi
  git clone "$clone_url" "$repo_dir" >/dev/null 2>&1
  cd "$repo_dir"
  mkdir -p .github/workflows
  cp "$selected" .github/workflows/autograde-and-sync.yml
  if git diff --quiet -- .github/workflows/autograde-and-sync.yml; then
    cd "$prev_dir"
    rm -rf "$repo_dir"
    return 0
  fi
  git add .github/workflows/autograde-and-sync.yml
  git commit -m "ci: apply autograde workflow template for ${unit_id:-default}" >/dev/null 2>&1
  git push origin HEAD:main >/dev/null 2>&1
  cd "$prev_dir"
  rm -rf "$repo_dir"
}

tail -n +2 "$CSV" | while IFS=, read -r repo unit_id user_id _rest; do
  repo="${repo//$'\r'/}"
  unit_id="${unit_id//$'\r'/}"
  user_id="${user_id//$'\r'/}"

  [[ -z "$repo" ]] && continue

  workflow_state="ok"
  variable_state="ok"
  secret_state="ok"
  result="updated"
  detail="ok"

  if [[ -z "$user_id" || -z "$unit_id" ]]; then
    echo "${repo},${unit_id},skip,skip,skip,skip,missing_mapping" >> "$OUT"
    continue
  fi

  if ! install_workflow_template "$repo" "$unit_id"; then
    workflow_state="failed"
    result="failed"
    detail="workflow_template_failed"
    echo "${repo},${unit_id},${workflow_state},${variable_state},${secret_state},${result},${detail}" >> "$OUT"
    continue
  fi

  if ! set_var "$repo" "VC_USER_ID" "$user_id" \
    || ! set_var "$repo" "VC_UNIT_ID" "$unit_id"; then
    variable_state="failed"
    result="failed"
    detail="set_variables_failed"
  fi

  # Secret handling:
  # - If secrets already exist in repo: pass
  # - Else if env values provided: write per-repo secrets
  # - Else mark missing_secrets (operator should use org-level shared secret or provide env values)
  if has_secret "$repo" "VC_AUTOGRADE_URL" && has_secret "$repo" "VC_AUTOGRADE_TOKEN"; then
    secret_state="ok"
  else
    if [[ -n "${VC_AUTOGRADE_URL_VALUE:-}" && -n "${VC_AUTOGRADE_TOKEN_VALUE:-}" ]]; then
      if set_secret "$repo" "VC_AUTOGRADE_URL" "${VC_AUTOGRADE_URL_VALUE:-}" \
        && set_secret "$repo" "VC_AUTOGRADE_TOKEN" "${VC_AUTOGRADE_TOKEN_VALUE:-}"; then
        secret_state="created"
      else
        secret_state="failed"
        result="failed"
        detail="set_secrets_failed"
      fi
    else
      secret_state="missing"
      [[ "$result" == "updated" ]] && result="warning"
      detail="missing_secrets"
    fi
  fi

  [[ "$MODE" == "--dry-run" ]] && result="dry-run"
  echo "${repo},${unit_id},${workflow_state},${variable_state},${secret_state},${result},${detail}" >> "$OUT"
done

echo "[DONE] $OUT"
