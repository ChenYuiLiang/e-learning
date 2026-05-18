#!/usr/bin/env bash
set -euo pipefail

# Add/update a standard autograde section in classroom bridge README.md files.
#
# Usage:
#   scripts/standardize_classroom_readme_autograde.sh --dry-run <csv_path>
#   scripts/standardize_classroom_readme_autograde.sh --apply <csv_path>

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 --dry-run|--apply <csv_path>"
  exit 1
fi

MODE="$1"
CSV_PATH="$2"
GH_BIN="${GH_BIN:-gh}"
OUT="/tmp/standardize_readme_autograde_$(date +%Y%m%d_%H%M%S).csv"

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "First arg must be --dry-run or --apply"
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH"
  exit 1
fi

echo "repo,status,detail" > "$OUT"

SECTION=$(cat <<'EOF'
## 自動評分與分數回寫（系統）

本單元使用 GitHub Actions 自動評分，並由系統自動回寫分數。

### 評分觸發方式
- `push` 到 `main/master`（需符合該 repo 的評分觸發條件）
- 或在 Actions 手動執行 `Classroom Grade + Sync`

### 分數規則（MVP）
- 若 `README.md` 含有 Markdown 任務核取方塊（`- [ ]` / `- [x]`），依完成比例評分：`已完成項目 / 總項目 * 100`
- 若未提供核取方塊，則採用 fallback：`README.md` 存在且非空為 `100/100`，否則 `0/100`

### 回寫到系統
- Workflow 會將分數送到 Vibe Coding 系統（`ingestGithubAutograde`）
- 學生可在 Dashboard Assignments 查看最新分數狀態

EOF
)

tail -n +2 "$CSV_PATH" | while IFS=, read -r repo _template _base _branch || [[ -n "${repo}" ]]; do
  repo="${repo//[$'\t\r\n ']}"
  [[ -z "$repo" ]] && continue
  [[ "$repo" == "bridge_repo" ]] && continue
  [[ "$repo" =~ ^# ]] && continue

  readme_json="$($GH_BIN api "repos/${repo}/contents/README.md" 2>/dev/null || true)"
  if [[ -z "$readme_json" ]]; then
    echo "$repo,error,missing_readme" >> "$OUT"
    continue
  fi

  sha="$(printf '%s' "$readme_json" | jq -r '.sha')"
  content_b64="$(printf '%s' "$readme_json" | jq -r '.content' | tr -d '\n')"
  current="$(printf '%s' "$content_b64" | base64 --decode 2>/dev/null || true)"

  if [[ -z "$current" ]]; then
    echo "$repo,error,readme_decode_failed" >> "$OUT"
    continue
  fi

  marker="## 自動評分與分數回寫（系統）"
  if grep -q "$marker" <<<"$current"; then
    updated="$(CURRENT_CONTENT="$current" SECTION_CONTENT="$SECTION" python3 - <<'PY'
import os, re
text = os.environ.get("CURRENT_CONTENT", "")
sec = os.environ.get("SECTION_CONTENT", "").rstrip() + "\n"
pattern = r"(?ms)^## 自動評分與分數回寫（系統）\n.*?(?=^## |\Z)"
if re.search(pattern, text):
    out = re.sub(pattern, sec + "\n", text, count=1)
else:
    out = text.rstrip() + "\n\n" + sec + "\n"
print(out, end="")
PY
)"
    detail="updated_section"
  else
    updated="${current}"$'\n\n'"${SECTION}"
    detail="appended_section"
  fi

  if [[ "$updated" == "$current" ]]; then
    echo "$repo,noop,no_changes" >> "$OUT"
    continue
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    echo "$repo,dry-run,$detail" >> "$OUT"
    continue
  fi

  updated_b64="$(printf '%s' "$updated" | base64 | tr -d '\n')"
  payload="$(jq -cn \
    --arg message "docs: standardize autograde and score sync section" \
    --arg content "$updated_b64" \
    --arg sha "$sha" \
    '{message:$message,content:$content,sha:$sha}')"

  if printf '%s' "$payload" | $GH_BIN api "repos/${repo}/contents/README.md" -X PUT --input - >/dev/null 2>&1; then
    echo "$repo,updated,$detail" >> "$OUT"
  else
    echo "$repo,error,update_failed" >> "$OUT"
  fi
done

echo "[DONE] $OUT"
