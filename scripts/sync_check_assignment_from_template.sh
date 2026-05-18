#!/usr/bin/env bash
set -euo pipefail

# Sync .github/scripts/check_assignment.sh from template repo to bridge repo
# by CSV mapping:
# bridge_repo,template_repo,base_branch,template_branch
#
# Usage:
#   scripts/sync_check_assignment_from_template.sh --dry-run <csv>
#   scripts/sync_check_assignment_from_template.sh --apply <csv>

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --dry-run|--apply <csv_path>"
  exit 1
fi

MODE="$1"
CSV_PATH="$2"

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "First arg must be --dry-run or --apply"
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH"
  exit 1
fi

OUT="/tmp/sync_check_assignment_$(date +%Y%m%d_%H%M%S).csv"
echo "bridge_repo,template_repo,status,detail" > "$OUT"

GH_BIN="${GH_BIN:-gh}"
TARGET_PATH=".github/scripts/check_assignment.sh"

while IFS=, read -r bridge_repo template_repo base_branch template_branch || [[ -n "${bridge_repo}${template_repo}" ]]; do
  bridge_repo="${bridge_repo//[$'\t\r\n ']}"
  template_repo="${template_repo//[$'\t\r\n ']}"
  base_branch="${base_branch//[$'\t\r\n ']}"
  template_branch="${template_branch//[$'\t\r\n ']}"

  [[ -z "$bridge_repo" ]] && continue
  [[ "$bridge_repo" == "bridge_repo" ]] && continue
  [[ "$bridge_repo" =~ ^# ]] && continue
  [[ -z "$template_repo" ]] && { echo "$bridge_repo,$template_repo,skip,missing_template_repo" >> "$OUT"; continue; }
  [[ -z "$base_branch" ]] && base_branch="main"
  [[ -z "$template_branch" ]] && template_branch="main"

  # Read template script content (base64-encoded from API)
  tmpl_content="$($GH_BIN api "repos/${template_repo}/contents/${TARGET_PATH}?ref=${template_branch}" --jq '.content' 2>/dev/null | tr -d '\n' || true)"
  if [[ -z "$tmpl_content" ]]; then
    echo "$bridge_repo,$template_repo,skip,template_missing_check_assignment" >> "$OUT"
    continue
  fi

  # Existing file SHA on bridge (if exists)
  bridge_sha="$($GH_BIN api "repos/${bridge_repo}/contents/${TARGET_PATH}?ref=${base_branch}" --jq '.sha' 2>/dev/null || true)"

  if [[ "$MODE" == "--dry-run" ]]; then
    if [[ -n "$bridge_sha" ]]; then
      echo "$bridge_repo,$template_repo,dry-run,would_update_existing" >> "$OUT"
    else
      echo "$bridge_repo,$template_repo,dry-run,would_create" >> "$OUT"
    fi
    continue
  fi

  if [[ -n "$bridge_sha" ]]; then
    payload="$(jq -cn \
      --arg message "ci: sync check_assignment.sh from template" \
      --arg content "$tmpl_content" \
      --arg sha "$bridge_sha" \
      --arg branch "$base_branch" \
      '{message:$message, content:$content, sha:$sha, branch:$branch}')"
    if printf '%s' "$payload" | $GH_BIN api "repos/${bridge_repo}/contents/${TARGET_PATH}" \
      -X PUT \
      --input - >/dev/null 2>&1; then
      echo "$bridge_repo,$template_repo,updated,ok" >> "$OUT"
    else
      echo "$bridge_repo,$template_repo,error,update_failed" >> "$OUT"
    fi
  else
    payload="$(jq -cn \
      --arg message "ci: add check_assignment.sh from template" \
      --arg content "$tmpl_content" \
      --arg branch "$base_branch" \
      '{message:$message, content:$content, branch:$branch}')"
    if printf '%s' "$payload" | $GH_BIN api "repos/${bridge_repo}/contents/${TARGET_PATH}" \
      -X PUT \
      --input - >/dev/null 2>&1; then
      echo "$bridge_repo,$template_repo,created,ok" >> "$OUT"
    else
      echo "$bridge_repo,$template_repo,error,create_failed" >> "$OUT"
    fi
  fi
done < "$CSV_PATH"

echo "[DONE] $OUT"
