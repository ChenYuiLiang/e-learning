#!/usr/bin/env bash
set -euo pipefail
CSV_PATH="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
MODE="${2:---dry-run}"
OUT="/tmp/bridge_readme_title_prefix_$(date +%Y%m%d_%H%M%S).csv"
echo "repo,status,detail" > "$OUT"

python - "$CSV_PATH" "$MODE" "$OUT" <<'PY'
import csv, json, base64, re, subprocess, sys
csv_path, mode, out_path = sys.argv[1:4]

def run(cmd):
    return subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

repos=[]
with open(csv_path,newline='') as f:
    r=csv.reader(f); next(r,None)
    for row in r:
        if row and row[0].strip(): repos.append(row[0].strip())

prefix_re = re.compile(r"^(#\s+)(?:\d{2}|start-\d{2}|basic-\d{2}|adv-\d{2})-unit-[a-z0-9-]+\s*:\s*(.+)$", re.I)

with open(out_path,'a',newline='') as f:
    w=csv.writer(f)
    for repo in repos:
        p=run(f"gh api repos/{repo}/contents/README.md")
        if p.returncode!=0:
            w.writerow([repo,'error',f'fetch failed: {p.stderr.strip()[:160]}'])
            continue
        j=json.loads(p.stdout)
        sha=j.get('sha')
        content=base64.b64decode(j['content']).decode('utf-8','ignore')
        lines=content.splitlines()
        if not lines:
            w.writerow([repo,'noop','empty readme'])
            continue
        m=prefix_re.match(lines[0])
        if not m:
            w.writerow([repo,'noop','title no target prefix'])
            continue
        lines[0]=f"{m.group(1)}{m.group(2).strip()}"
        new_content="\n".join(lines)
        if content.endswith("\n"):
            new_content += "\n"
        if mode!='--apply':
            w.writerow([repo,'dry-run',f"{m.group(0)} -> {lines[0]}"])
            continue
        b64=base64.b64encode(new_content.encode('utf-8')).decode('ascii')
        payload={
            'message':'docs: remove unit-id prefix from README title',
            'content':b64,
            'sha':sha,
            'branch':'main'
        }
        q=run("gh api -X PUT repos/{}/contents/README.md --input - <<'JSON'\n{}\nJSON".format(repo,json.dumps(payload,ensure_ascii=False)))
        if q.returncode!=0:
            w.writerow([repo,'error',f'update failed: {q.stderr.strip()[:160]}'])
        else:
            w.writerow([repo,'updated',f"{m.group(0)} -> {lines[0]}"])

print(out_path)
PY

echo "[DONE] $OUT"
