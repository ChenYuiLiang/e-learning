#!/usr/bin/env bash
set -euo pipefail

# Prepare manual fix branches for bridge repos with unrelated histories.
# Strategy: create a branch and replace contents from template repo (except .git), then commit and push.
# Use this only when you intentionally want bridge repo content to follow template repo baseline.

CSV_PATH="${1:-docs/examples/classroom-bridge-unrelated-r2.csv}"
DATE_TAG="${2:-$(date +%F)-manual-fix}"
WORKDIR="${3:-/tmp/classroom-bridge-unrelated-fix-$$}"
RUN_STAMP="$(date +%H%M%S)"
PR_LABEL="${PR_LABEL:-classroom-bridge-sync}"

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

    # Derive template from naming convention:
    # bridge: vibe-coding-classroom/vibe-coding-classroom-<unit>-<unit>
    # template: vibe-coding-classroom/<unit>
    repo_tail="${bridge_repo#vibe-coding-classroom/vibe-coding-classroom-}"
    # Split by "-" and keep the first half tokens as unit id.
    parts_count="$(awk -F- '{print NF}' <<< "$repo_tail")"
    half_count=$((parts_count / 2))
    unit_id="$(awk -F- -v n="$half_count" '{for(i=1;i<=n;i++){printf "%s%s",$i,(i<n?"-":"")}}' <<< "$repo_tail")"
    template_repo="vibe-coding-classroom/${unit_id}"

    repo_dir="$WORKDIR/${bridge_repo##*/}"
    template_dir="$WORKDIR/template-${unit_id}"
    fix_branch="manual-sync/${DATE_TAG}-${RUN_STAMP}-${unit_id}"

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

      pr_title="chore: manual sync from template (${unit_id})"
      pr_body="Manual sync for previously unrelated-history bridge repo.\n\nTemplate: ${template_repo}\nStrategy: replace bridge content with template baseline."

      set +e
      pr_url=$(gh pr create --repo "$bridge_repo" --base main --head "$fix_branch" \
        --title "$pr_title" \
        --body "$pr_body" \
        --label "$PR_LABEL" 2>/tmp/gh_manual_sync_pr_err.txt)
      pr_rc=$?
      set -e

      if [[ $pr_rc -ne 0 ]]; then
        label_not_found=1
        if command -v rg >/dev/null 2>&1; then
          if rg -q "label.*not found" /tmp/gh_manual_sync_pr_err.txt; then
            label_not_found=0
          fi
        else
          if grep -Eq "label.*not found" /tmp/gh_manual_sync_pr_err.txt; then
            label_not_found=0
          fi
        fi

        if [[ $label_not_found -eq 0 ]]; then
          pr_url=$(gh pr create --repo "$bridge_repo" --base main --head "$fix_branch" \
            --title "$pr_title" \
            --body "$pr_body")
          echo "[WARN] Label '$PR_LABEL' not found in $bridge_repo, created PR without label."
        else
          err_msg="$(tr '\n' ' ' < /tmp/gh_manual_sync_pr_err.txt | sed 's/,/;/g')"
          echo "$bridge_repo,error,pr create failed: ${err_msg}," >> "$REPORT"
          exit 0
        fi
      fi

      echo "$bridge_repo,opened,manual-sync,$pr_url" >> "$REPORT"
      echo "[OK] $pr_url"
    )
  done
} < "$CSV_PATH"

echo "\n[DONE] $REPORT"
