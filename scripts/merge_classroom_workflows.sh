#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
MODE="${2:---dry-run}" # --dry-run | --apply
WORKDIR="${3:-/tmp/merge-classroom-workflows-$$}"

mkdir -p "$WORKDIR"
REPORT="$WORKDIR/merge_workflows_report_$(date +%Y%m%d_%H%M%S).csv"
echo "repo,status,detail" > "$REPORT"

cat > "$WORKDIR/autograde-and-sync.yml" <<'YAML'
name: Classroom Grade + Sync

on:
  workflow_dispatch:
    inputs:
      run_mode:
        description: "grade_and_sync or sync_only"
        required: false
        default: "grade_and_sync"
        type: choice
        options:
          - grade_and_sync
          - sync_only
      score_override:
        description: "Optional score override (e.g. 83)"
        required: false
        type: string
      max_score:
        description: "Max score"
        required: false
        default: "100"
        type: string
      status_override:
        description: "Optional status override"
        required: false
        default: ""
        type: string
  push:
    branches: [ main, master ]

permissions:
  contents: read

jobs:
  grade_and_sync:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      vars.VC_AUTOGRADE_ON_PUSH == 'true' ||
      contains(github.event.head_commit.message, '[autograde]')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Grader
        id: grader
        shell: bash
        run: |
          set -euo pipefail

          RUN_MODE="${{ github.event.inputs.run_mode }}"
          SCORE_OVERRIDE="${{ github.event.inputs.score_override }}"
          MAX_SCORE="${{ github.event.inputs.max_score || '100' }}"
          STATUS_OVERRIDE="${{ github.event.inputs.status_override }}"

          if [ -n "$SCORE_OVERRIDE" ]; then
            echo "score=$SCORE_OVERRIDE" >> "$GITHUB_OUTPUT"
            echo "max_score=$MAX_SCORE" >> "$GITHUB_OUTPUT"
            echo "status=${STATUS_OVERRIDE:-completed}" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          if [ "$RUN_MODE" = "sync_only" ]; then
            echo "score=100" >> "$GITHUB_OUTPUT"
            echo "max_score=$MAX_SCORE" >> "$GITHUB_OUTPUT"
            echo "status=${STATUS_OVERRIDE:-completed}" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          # Inline grading based on README checklist progress with optional weights.
          # Supported weight formats per checklist line:
          # - [ ] Task title [w:20]
          # - [ ] Task title (20%)
          # - [ ] Task title [weight=20]
          # If no weights are provided, fallback to equal-weight checklist scoring.
          if [ ! -f README.md ]; then
            SCORE_VAL=0
          else
            SCORE_VAL=$(python3 - <<'PY'
import re
from pathlib import Path

max_score = int("${MAX_SCORE}")
text = Path("README.md").read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines()

check_re = re.compile(r'^\s*[-*]\s+\[(?P<done>[ xX])\]\s+(?P<body>.+)$')
weight_patterns = [
    re.compile(r'\[w(?:eight)?\s*[:=]\s*(\d+(?:\.\d+)?)\]', re.IGNORECASE),
    re.compile(r'\((\d+(?:\.\d+)?)%\)')
]

items = []
for line in lines:
    m = check_re.match(line)
    if not m:
        continue
    done = m.group("done").lower() == "x"
    body = m.group("body")
    weight = None
    for p in weight_patterns:
        wm = p.search(body)
        if wm:
            try:
                weight = float(wm.group(1))
            except Exception:
                weight = None
            break
    items.append((done, weight))

if not items:
    # No checklist: fallback
    score = max_score if text.strip() else 0
    print(score)
    raise SystemExit

weighted_items = [(d, w) for d, w in items if w is not None and w > 0]

if weighted_items:
    total_w = sum(w for _, w in weighted_items)
    done_w = sum(w for d, w in weighted_items if d)
    ratio = 0 if total_w <= 0 else done_w / total_w
else:
    total = len(items)
    done = sum(1 for d, _ in items if d)
    ratio = 0 if total == 0 else done / total

score = int(round(max_score * ratio))
score = max(0, min(max_score, score))
print(score)
PY
)
          fi

          echo "score=$SCORE_VAL" >> "$GITHUB_OUTPUT"
          echo "max_score=$MAX_SCORE" >> "$GITHUB_OUTPUT"
          if [ "$SCORE_VAL" -ge "$MAX_SCORE" ]; then
            echo "status=${STATUS_OVERRIDE:-completed}" >> "$GITHUB_OUTPUT"
          elif [ "$SCORE_VAL" -gt 0 ]; then
            echo "status=${STATUS_OVERRIDE:-in_progress}" >> "$GITHUB_OUTPUT"
          else
            echo "status=${STATUS_OVERRIDE:-failed}" >> "$GITHUB_OUTPUT"
          fi

      - name: Build Payload
        id: payload
        shell: bash
        env:
          DEFAULT_USER_ID: ${{ vars.VC_USER_ID }}
          DEFAULT_UNIT_ID: ${{ vars.VC_UNIT_ID }}
          REPO: ${{ github.repository }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
          WORKFLOW_NAME: ${{ github.workflow }}
          COMMIT_SHA: ${{ github.sha }}
          ACTOR: ${{ github.actor }}
        run: |
          set -euo pipefail

          USER_ID="${DEFAULT_USER_ID:-}"
          UNIT_ID="${DEFAULT_UNIT_ID:-}"
          SCORE="${{ steps.grader.outputs.score }}"
          MAX_SCORE="${{ steps.grader.outputs.max_score }}"
          STATUS="${{ steps.grader.outputs.status }}"

          if [ -z "$SCORE" ]; then
            echo "score missing"; exit 1
          fi
          if [ -z "$USER_ID" ] || [ -z "$UNIT_ID" ]; then
            echo "Need vars.VC_USER_ID+VC_UNIT_ID."; exit 1
          fi

          PAYLOAD=$(jq -cn \
            --arg userId "$USER_ID" \
            --arg unitId "$UNIT_ID" \
            --argjson score "$SCORE" \
            --argjson maxScore "$MAX_SCORE" \
            --arg status "$STATUS" \
            --arg runUrl "$RUN_URL" \
            --arg workflow "$WORKFLOW_NAME" \
            --arg commitSha "$COMMIT_SHA" \
            --arg repo "$REPO" \
            --arg actor "$ACTOR" \
            '{
              userId: ($userId | select(length > 0)),
              unitId: ($unitId | select(length > 0)),
              score: $score,
              maxScore: $maxScore,
              status: $status,
              runUrl: $runUrl,
              workflow: $workflow,
              commitSha: $commitSha,
              repo: $repo,
              actor: $actor
            }')

          echo "payload=$PAYLOAD" >> "$GITHUB_OUTPUT"

      - name: Send Score To Vibe Coding
        shell: bash
        env:
          VC_AUTOGRADE_URL: ${{ secrets.VC_AUTOGRADE_URL }}
          VC_AUTOGRADE_TOKEN: ${{ secrets.VC_AUTOGRADE_TOKEN }}
          PAYLOAD: ${{ steps.payload.outputs.payload }}
        run: |
          set -euo pipefail
          [ -n "${VC_AUTOGRADE_URL:-}" ] || { echo "Missing VC_AUTOGRADE_URL"; exit 1; }
          [ -n "${VC_AUTOGRADE_TOKEN:-}" ] || { echo "Missing VC_AUTOGRADE_TOKEN"; exit 1; }

          SIG="sha256=$(printf %s "$PAYLOAD" | openssl dgst -sha256 -hmac "$VC_AUTOGRADE_TOKEN" | sed 's/^.* //')"

          curl -sS -X POST "$VC_AUTOGRADE_URL" \
            -H "Content-Type: application/json" \
            -H "X-Hub-Signature-256: $SIG" \
            -d "$PAYLOAD"
YAML

while IFS=, read -r repo template base_branch template_branch || [[ -n "${repo}${template}${base_branch}${template_branch}" ]]; do
  repo="${repo//[$'\t\r\n ']}"
  base_branch="${base_branch//[$'\t\r\n ']}"
  [[ -z "$repo" ]] && continue
  [[ "$repo" == "bridge_repo" ]] && continue
  [[ "$repo" =~ ^# ]] && continue
  [[ -z "$base_branch" ]] && base_branch="main"

  dir="$WORKDIR/${repo##*/}"
  rm -rf "$dir"

  if ! gh repo clone "$repo" "$dir" -- -q; then
    echo "$repo,error,clone failed" >> "$REPORT"
    continue
  fi

  pushd "$dir" >/dev/null
  git checkout "$base_branch" >/dev/null 2>&1 || true
  mkdir -p .github/workflows
  cp "$WORKDIR/autograde-and-sync.yml" .github/workflows/autograde-and-sync.yml

  rm -f .github/workflows/grading.yml
  rm -f .github/workflows/autograde-sync.yml
  rm -f .github/workflows/classroom.yml

  git add .github/workflows

  if git diff --cached --quiet; then
    echo "$repo,noop,no workflow changes" >> "$REPORT"
    popd >/dev/null
    continue
  fi

  if [[ "$MODE" != "--apply" ]]; then
    echo "$repo,dry-run,would merge workflows" >> "$REPORT"
    popd >/dev/null
    continue
  fi

  git commit -m "ci: merge grading+sync workflow with push toggle" >/dev/null
  if git push origin "$base_branch" >/dev/null 2>&1; then
    echo "$repo,updated,merged to $base_branch" >> "$REPORT"
  else
    echo "$repo,error,push failed" >> "$REPORT"
  fi

  popd >/dev/null
done < "$CSV_PATH"

echo "[DONE] $REPORT"
