#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --dry-run|--apply <csv_path>"
  exit 1
fi

MODE="$1"
CSV_PATH="$2"
GH_BIN="${GH_BIN:-gh}"
OUT="/tmp/revert_readme_autograde_section_$(date +%Y%m%d_%H%M%S).csv"

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "First arg must be --dry-run or --apply"
  exit 1
fi

echo "repo,status,detail" > "$OUT"

tail -n +2 "$CSV_PATH" | while IFS=, read -r repo _rest || [[ -n "${repo}" ]]; do
  repo="${repo//[$'\t\r\n ']}"
  [[ -z "$repo" || "$repo" == "bridge_repo" ]] && continue

  json="$($GH_BIN api "repos/${repo}/contents/README.md" 2>/dev/null || true)"
  if [[ -z "$json" ]]; then
    echo "$repo,error,missing_readme" >> "$OUT"
    continue
  fi

  sha="$(printf '%s' "$json" | jq -r '.sha')"
  content_b64="$(printf '%s' "$json" | jq -r '.content' | tr -d '\n')"
  current="$(printf '%s' "$content_b64" | base64 --decode 2>/dev/null || true)"
  if [[ -z "$current" ]]; then
    echo "$repo,error,decode_failed" >> "$OUT"
    continue
  fi

  updated="$(CURRENT_CONTENT="$current" python3 - <<'PY'
import os, re
text = os.environ.get("CURRENT_CONTENT", "")
pattern = r"(?ms)\n*## 自動評分與分數回寫（系統）\n.*?(?=^## |\Z)"
new = re.sub(pattern, "\n", text, count=1).rstrip() + "\n"
print(new, end="")
PY
)"

  if [[ "$updated" == "$current" ]]; then
    echo "$repo,noop,no_section" >> "$OUT"
    continue
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    echo "$repo,dry-run,would_remove_section" >> "$OUT"
    continue
  fi

  new_b64="$(printf '%s' "$updated" | base64 | tr -d '\n')"
  payload="$(jq -cn --arg message "docs: revert autograde section injection" --arg content "$new_b64" --arg sha "$sha" '{message:$message,content:$content,sha:$sha}')"
  if printf '%s' "$payload" | $GH_BIN api "repos/${repo}/contents/README.md" -X PUT --input - >/dev/null 2>&1; then
    echo "$repo,updated,section_removed" >> "$OUT"
  else
    echo "$repo,error,update_failed" >> "$OUT"
  fi
done

echo "[DONE] $OUT"
