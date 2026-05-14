#!/usr/bin/env bash
set -euo pipefail

# Prepare manual fix branches for bridge repos with unrelated histories.
# Strategy: create a branch and replace contents from template repo (except .git), then commit and push.
# Use this only when you intentionally want bridge repo content to follow template repo baseline.

CSV_PATH="${1:-docs/examples/classroom-bridge-unrelated-r2.csv}"
DATE_TAG="${2:-$(date +%F)-manual-fix}"
WORKDIR="${3:-/tmp/classroom-bridge-unrelated-fix-$$}"

if [[ ! -f "$CSV_PATH" ]]; then
  echo "[ERROR] CSV not found: $CSV_PATH" >&2
  exit 1
fi

command -v gh >/dev/null 2>&1 || { echo "[ERROR] gh not found" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "[ERROR] git not found" >&2; exit 1; }

mkdir -p "$WORKDIR"
REPORT="$WORKDIR/unrelated_fix_report_${DATE_TAG}.csv"
echo "bridge_repo,status,detail,pr_url" > "$REPORT"

echo "[INFO] CSV: $CSV_PATH"
echo "[INFO] Workdir: $WORKDIR"
echo "[INFO] Report: $REPORT"

{ read -r _header || true
  while IFS=, read -r bridge_repo status detail _pr || [[ -n "${bridge_repo}${status}" ]]; do
    [[ -z "$bridge_repo" ]] && continue
    [[ "$bridge_repo" =~ ^# ]] && continue

    # Derive template from naming convention: vibe-coding-classroom/vibe-coding-classroom-<unit>-<unit>
    repo_tail="${bridge_repo#vibe-coding-classroom/vibe-coding-classroom-}"
    unit_id="$(echo "$repo_tail" | sed -E 's/(.*)-\1$/\1/')"
    template_repo="vibe-coding-classroom/${unit_id}"

    repo_dir="$WORKDIR/${bridge_repo##*/}"
    template_dir="$WORKDIR/template-${unit_id}"
    fix_branch="manual-sync/${DATE_TAG}-${unit_id}"

    echo "\n[INFO] Processing $bridge_repo (template: $template_repo)"

    rm -rf "$repo_dir" "$template_dir"
    if ! gh repo clone "$bridge_repo" "$repo_dir" -- -q; then
      echo "$bridge_repo,error,clone bridge failed," >> "$REPORT"
      continue
    fi
    if ! gh repo clone "$template_repo" "$template_dir" -- -q; then
      echo "$bridge_repo,error,clone template failed," >> "$REPORT"
      continue
    fi

    (
      set -e
      cd "$repo_dir"
      git checkout -B "$fix_branch" origin/main >/dev/null

      find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
      rsync -a --exclude '.git' "$template_dir/" "$repo_dir/"

      if [[ -z "$(git status --porcelain)" ]]; then
        echo "$bridge_repo,noop,already matches template," >> "$REPORT"
        exit 0
      fi

      git add -A
      git commit -m "chore: align bridge repo with template ${unit_id}"
      git push -u origin "$fix_branch" >/dev/null

      pr_url=$(gh pr create --repo "$bridge_repo" --base main --head "$fix_branch" \
        --title "chore: manual sync from template (${unit_id})" \
        --body "Manual sync for previously unrelated-history bridge repo.\n\nTemplate: ${template_repo}\nStrategy: replace bridge content with template baseline." \
        --label classroom-bridge-sync)

      echo "$bridge_repo,opened,manual-sync,$pr_url" >> "$REPORT"
      echo "[OK] $pr_url"
    )
  done
} < "$CSV_PATH"

echo "\n[DONE] $REPORT"
