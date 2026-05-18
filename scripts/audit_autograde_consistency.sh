#!/usr/bin/env bash
set -euo pipefail

# Audit classroom repos for:
# - workflow presence/shape
# - grader script presence
# - README alignment (heuristic)
# - required secrets/vars
# - latest writeback run status
#
# Usage:
#   scripts/audit_autograde_consistency.sh [csv_path]
#
# Input CSV default:
#   docs/examples/classroom-bridge-sync-units-only.csv
# Expected column: bridge_repo

CSV_PATH="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
OUT="/tmp/autograde_consistency_audit_$(date +%Y%m%d_%H%M%S).csv"

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 1
fi

GH_BIN="${GH_BIN:-gh}"

echo "repo,workflow_ok,grader_ok,readme_mapping_ok,secrets_ok,vars_ok,last_writeback_ok,issues" > "$OUT"

trim() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s//$'\n'/}"
  echo "$s"
}

get_content() {
  local repo="$1"
  local path="$2"
  "$GH_BIN" api "repos/${repo}/contents/${path}" --jq '.content' 2>/dev/null | tr -d '\n' | base64 --decode 2>/dev/null || true
}

has_workflow() {
  local repo="$1"
  "$GH_BIN" api "repos/${repo}/contents/.github/workflows/autograde-and-sync.yml" >/dev/null 2>&1
}

has_classroom_workflow() {
  local repo="$1"
  "$GH_BIN" api "repos/${repo}/contents/.github/workflows/classroom.yml" >/dev/null 2>&1
}

has_path() {
  local repo="$1"
  local path="$2"
  "$GH_BIN" api "repos/${repo}/contents/${path}" >/dev/null 2>&1
}

has_secret() {
  local repo="$1"
  local name="$2"
  "$GH_BIN" api "repos/${repo}/actions/secrets/${name}" >/dev/null 2>&1
}

has_var() {
  local repo="$1"
  local name="$2"
  "$GH_BIN" api "repos/${repo}/actions/variables/${name}" >/dev/null 2>&1
}

latest_run_status() {
  local repo="$1"
  "$GH_BIN" api "repos/${repo}/actions/workflows/autograde-and-sync.yml/runs?per_page=1" \
    --jq '.workflow_runs[0] | "\(.status),\(.conclusion)"' 2>/dev/null || true
}

tail -n +2 "$CSV_PATH" | while IFS=, read -r bridge_repo _rest; do
  repo="$(trim "${bridge_repo:-}")"
  [[ -z "$repo" ]] && continue
  [[ "$repo" =~ ^# ]] && continue

  workflow_ok="no"
  grader_ok="no"
  readme_mapping_ok="manual"
  secrets_ok="no"
  vars_ok="no"
  last_writeback_ok="unknown"
  issues=()

  if has_workflow "$repo"; then
    wf="$(get_content "$repo" ".github/workflows/autograde-and-sync.yml")"
    if [[ "$wf" == *".github/scripts/check_assignment.sh"* && "$wf" == *"Send Score To Vibe Coding"* ]]; then
      workflow_ok="yes"
    else
      issues+=("autograde-and-sync.yml_mismatch")
    fi
  else
    issues+=("missing_autograde-and-sync.yml")
  fi

  if has_classroom_workflow "$repo"; then
    issues+=("duplicate_classroom.yml_present")
  fi

  if has_path "$repo" ".github/scripts/check_assignment.sh"; then
    grader_ok="yes"
  else
    issues+=("missing_check_assignment.sh")
  fi

  # README alignment heuristic:
  # If README mentions GitHub Classroom and either check script name or key deliverable words.
  readme="$(get_content "$repo" "README.md")"
  if [[ -n "$readme" ]]; then
    if [[ "$readme" == *"GitHub Classroom"* || "$readme" == *"classroom.github.com"* ]]; then
      if [[ "$readme" == *"check_assignment"* || "$readme" == *"README"* || "$readme" == *"作業"* ]]; then
        readme_mapping_ok="yes"
      else
        readme_mapping_ok="manual"
        issues+=("readme_needs_grading_clarification")
      fi
    else
      readme_mapping_ok="manual"
      issues+=("readme_missing_classroom_context")
    fi
  else
    readme_mapping_ok="no"
    issues+=("missing_readme")
  fi

  if has_secret "$repo" "VC_AUTOGRADE_URL" && has_secret "$repo" "VC_AUTOGRADE_TOKEN"; then
    secrets_ok="yes"
  else
    issues+=("missing_autograde_secrets")
  fi

  # Either VC_ASSIGNMENT_DOC_ID or (VC_USER_ID + VC_ASSIGNMENT_ID)
  if has_var "$repo" "VC_ASSIGNMENT_DOC_ID"; then
    vars_ok="yes"
  elif has_var "$repo" "VC_USER_ID" && has_var "$repo" "VC_ASSIGNMENT_ID"; then
    vars_ok="yes"
  else
    issues+=("missing_assignment_mapping_vars")
  fi

  run_state="$(latest_run_status "$repo")"
  if [[ -n "$run_state" && "$run_state" != "null,null" ]]; then
    # status,conclusion
    if [[ "$run_state" == "completed,success" ]]; then
      last_writeback_ok="yes"
    elif [[ "$run_state" == completed,* ]]; then
      last_writeback_ok="no"
      issues+=("last_run_not_success:${run_state}")
    else
      last_writeback_ok="pending"
      issues+=("last_run_pending:${run_state}")
    fi
  else
    issues+=("no_workflow_run_data")
  fi

  if [[ "${#issues[@]}" -eq 0 ]]; then
    issue_text="ok"
  else
    issue_text="$(IFS=';'; echo "${issues[*]}")"
  fi

  echo "${repo},${workflow_ok},${grader_ok},${readme_mapping_ok},${secrets_ok},${vars_ok},${last_writeback_ok},\"${issue_text}\"" >> "$OUT"
done

echo "[DONE] $OUT"
