#!/usr/bin/env bash
set -euo pipefail

# Batch sync "bridge" repos (e.g., vibe-coding-classroom-*) from original template repos.
# Default mode is DRY-RUN.

usage() {
  cat <<'USAGE'
Usage:
  scripts/sync_classroom_bridge_repos.sh --csv <path> [options]

Required:
  --csv <path>

CSV columns:
  bridge_repo,template_repo,base_branch,template_branch

  bridge_repo      e.g. vibe-coding-classroom/vibe-coding-classroom-01-unit-vscode-online-01-unit-vscode-online
  template_repo    e.g. vibe-coding-classroom/01-unit-vscode-online
  base_branch      optional, default: main
  template_branch  optional, default: main

Options:
  --branch-prefix <value>   default: sync-bridge
  --date-tag <YYYY-MM-DD>   default: today
  --apply                   execute push + PR create (default: dry-run)
  --workdir <path>          default: /tmp/classroom-bridge-sync-<pid>
  --pr-label <label>        optional PR label
  --help

Examples:
  scripts/sync_classroom_bridge_repos.sh --csv docs/examples/classroom-bridge-sync-sample.csv
  scripts/sync_classroom_bridge_repos.sh --csv ./bridge_targets.csv --apply --pr-label classroom-bridge-sync
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[ERROR] Missing command: $1" >&2
    exit 1
  }
}

CSV_PATH=""
BRANCH_PREFIX="sync-bridge"
DATE_TAG="$(date +%F)"
APPLY="false"
WORKDIR="/tmp/classroom-bridge-sync-$$"
PR_LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv) CSV_PATH="${2:-}"; shift 2 ;;
    --branch-prefix) BRANCH_PREFIX="${2:-}"; shift 2 ;;
    --date-tag) DATE_TAG="${2:-}"; shift 2 ;;
    --apply) APPLY="true"; shift ;;
    --workdir) WORKDIR="${2:-}"; shift 2 ;;
    --pr-label) PR_LABEL="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "[ERROR] Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$CSV_PATH" ]]; then
  echo "[ERROR] --csv is required" >&2
  usage
  exit 1
fi
[[ -f "$CSV_PATH" ]] || { echo "[ERROR] CSV not found: $CSV_PATH" >&2; exit 1; }

require_cmd git
require_cmd gh

mkdir -p "$WORKDIR"
REPORT_FILE="$WORKDIR/bridge_sync_report_${DATE_TAG}.csv"
echo "bridge_repo,status,detail,pr_url" > "$REPORT_FILE"

echo "[INFO] Mode: $([[ "$APPLY" == "true" ]] && echo APPLY || echo DRY-RUN)"
echo "[INFO] Workdir: $WORKDIR"
echo "[INFO] Report: $REPORT_FILE"

{ read -r _header || true
  while IFS=, read -r bridge_repo template_repo base_branch template_branch || [[ -n "${bridge_repo}${template_repo}${base_branch}${template_branch}" ]]; do
    bridge_repo="${bridge_repo//[$'\t\r\n ']}"
    template_repo="${template_repo//[$'\t\r\n ']}"
    base_branch="${base_branch//[$'\t\r\n ']}"
    template_branch="${template_branch//[$'\t\r\n ']}"

    [[ -z "$bridge_repo" ]] && continue
    [[ "$bridge_repo" =~ ^# ]] && continue

    base_branch="${base_branch:-main}"
    template_branch="${template_branch:-main}"

    if [[ -z "$template_repo" ]]; then
      echo "[WARN] $bridge_repo -> missing template_repo, skip"
      echo "$bridge_repo,skipped,missing template_repo," >> "$REPORT_FILE"
      continue
    fi

    repo_dir="$WORKDIR/${bridge_repo##*/}"
    sync_branch="${BRANCH_PREFIX}/${DATE_TAG}-${template_repo##*/}"

    echo
    echo "[INFO] Processing: $bridge_repo"
    echo "       Template:  $template_repo"
    echo "       Branch:    $sync_branch"

    if [[ "$APPLY" != "true" ]]; then
      echo "[DRY] gh repo clone $bridge_repo $repo_dir"
      echo "[DRY] git remote add upstream https://github.com/$template_repo.git"
      echo "[DRY] git fetch upstream $template_branch"
      echo "[DRY] git checkout -B $sync_branch origin/$base_branch"
      echo "[DRY] git merge --no-ff --no-edit upstream/$template_branch"
      echo "[DRY] git push -u origin $sync_branch"
      echo "[DRY] gh pr create --repo $bridge_repo --base $base_branch --head $sync_branch"
      echo "$bridge_repo,dry-run,planned," >> "$REPORT_FILE"
      continue
    fi

    rm -rf "$repo_dir"
    if ! gh repo clone "$bridge_repo" "$repo_dir" -- -q; then
      echo "[ERROR] clone failed: $bridge_repo"
      echo "$bridge_repo,error,clone failed," >> "$REPORT_FILE"
      continue
    fi

    (
      set -e
      cd "$repo_dir"

      if git remote get-url upstream >/dev/null 2>&1; then
        git remote set-url upstream "https://github.com/${template_repo}.git"
      else
        git remote add upstream "https://github.com/${template_repo}.git"
      fi

      git fetch origin "$base_branch" --quiet
      git fetch upstream "$template_branch" --quiet
      git checkout -B "$sync_branch" "origin/$base_branch" >/dev/null

      base_head="$(git rev-parse HEAD)"
      set +e
      git merge --no-ff --no-edit "upstream/$template_branch"
      merge_rc=$?
      set -e

      if [[ $merge_rc -ne 0 ]]; then
        if git merge --abort >/dev/null 2>&1; then
          echo "[WARN] merge conflict: $bridge_repo"
          echo "$bridge_repo,conflict,manual merge required," >> "$REPORT_FILE"
        else
          echo "[WARN] unrelated histories: $bridge_repo"
          echo "$bridge_repo,unrelated,requires --allow-unrelated-histories strategy," >> "$REPORT_FILE"
        fi
        exit 0
      fi

      new_head="$(git rev-parse HEAD)"
      if [[ "$new_head" == "$base_head" ]]; then
        echo "[INFO] no changes: $bridge_repo"
        echo "$bridge_repo,noop,already up to date," >> "$REPORT_FILE"
        exit 0
      fi

      git push -u origin "$sync_branch" --quiet

      pr_title="chore: sync bridge repo from ${template_repo##*/} (${DATE_TAG})"
      pr_body=$(cat <<PRBODY
This PR syncs bridge repo from the canonical template repo.

- bridge repo: ${bridge_repo}
- template repo: ${template_repo}
- template branch: ${template_branch}
- sync date: ${DATE_TAG}

Please review before merging into ${base_branch}.
PRBODY
)

      pr_cmd=(gh pr create --repo "$bridge_repo" --base "$base_branch" --head "$sync_branch" --title "$pr_title" --body "$pr_body")
      if [[ -n "$PR_LABEL" ]]; then
        pr_cmd+=(--label "$PR_LABEL")
      fi

      set +e
      pr_url="$("${pr_cmd[@]}" 2>/tmp/gh_bridge_pr_err.txt)"
      pr_rc=$?
      set -e

      if [[ $pr_rc -ne 0 ]]; then
        err_msg="$(tr '\n' ' ' < /tmp/gh_bridge_pr_err.txt | sed 's/,/;/g')"
        echo "[ERROR] PR create failed: $bridge_repo"
        echo "$bridge_repo,error,pr create failed: ${err_msg}," >> "$REPORT_FILE"
        exit 0
      fi

      echo "[OK] PR: $pr_url"
      echo "$bridge_repo,opened,success,$pr_url" >> "$REPORT_FILE"
    )
  done
} < "$CSV_PATH"

echo
echo "[DONE] Report generated: $REPORT_FILE"
