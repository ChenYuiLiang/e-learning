#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
MODE="${2:---dry-run}" # --dry-run | --apply
OUT="/tmp/bridge_readme_tone_$(date +%Y%m%d_%H%M%S).csv"

echo "repo,status,detail" > "$OUT"

python - "$CSV_PATH" "$MODE" "$OUT" <<'PY'
import base64, csv, json, re, subprocess, sys
from datetime import date

csv_path, mode, out_path = sys.argv[1:4]

verb_replacements = [
    (r"編輯檔案\\s*[:：]\\s*打開\\s*`?([^`\\s]+)`?\\s*檔案", r"建立新檔案：建立 `\\1` 檔案"),
    (r"修改檔案\\s*[:：]\\s*打開\\s*`?([^`\\s]+)`?\\s*檔案", r"建立新檔案：建立 `\\1` 檔案"),
    (r"編輯\\s*`?([^`\\s]+)`?\\s*檔案", r"建立 `\\1` 檔案"),
    (r"修改\\s*`?([^`\\s]+)`?\\s*檔案", r"建立 `\\1` 檔案"),
    (r"修改既有檔案", "建立新檔案"),
    (r"編輯既有檔案", "建立新檔案"),
    (r"請修改", "請建立"),
    (r"請編輯", "請建立"),
    (r"更新\s*`?(docs/[^`\s)]+)`?", r"建立 `\1`"),
    (r"在\s*`README\.md`\s*\(或指定報告中\)", "在新建立的報告檔中"),
    (r"在\s*`README\.md`", "在新建立的報告檔中"),
]

def run(cmd):
    return subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def fetch_readme(repo):
    p = run(f"gh api repos/{repo}/contents/README.md")
    if p.returncode != 0:
        return None, None, p.stderr.strip()
    j = json.loads(p.stdout)
    content = base64.b64decode(j["content"]).decode("utf-8", "ignore")
    return content, j.get("sha"), None

def push_readme(repo, content, sha):
    b64 = base64.b64encode(content.encode("utf-8")).decode("ascii")
    payload = {
        "message": "docs: normalize bridge README tone and remove stale relative links",
        "content": b64,
        "sha": sha,
        "branch": "main"
    }
    p = run(f"gh api -X PUT repos/{repo}/contents/README.md --input - <<'JSON'\n{json.dumps(payload, ensure_ascii=False)}\nJSON")
    return p

repos = []
with open(csv_path, newline='') as f:
    r = csv.reader(f)
    next(r, None)
    for row in r:
        if row and row[0].strip():
            repos.append(row[0].strip())

with open(out_path, 'a', newline='') as f:
    w = csv.writer(f)
    for repo in repos:
        content, sha, err = fetch_readme(repo)
        if err:
            w.writerow([repo, 'error', f'fetch failed: {err[:180]}'])
            continue

        original = content

        # Remove stale relative markdown links: [text](relative/path)
        content = re.sub(r"\[([^\]]+)\]\((?!https?://|mailto:|#)([^)]+)\)", r"\1", content)

        # Tone normalization replacements
        for pat, repl in verb_replacements:
            content = re.sub(pat, repl, content)

        if content == original:
            w.writerow([repo, 'noop', 'no textual changes'])
            continue

        if mode != '--apply':
            w.writerow([repo, 'dry-run', 'would update README.md'])
            continue

        p = push_readme(repo, content, sha)
        if p.returncode != 0:
            w.writerow([repo, 'error', f'update failed: {p.stderr.strip()[:180]}'])
        else:
            w.writerow([repo, 'updated', 'README.md updated'])

print(out_path)
PY

echo "[DONE] $OUT"
