#!/usr/bin/env python3
import csv
import subprocess
import json
import sys
import os
from concurrent.futures import ThreadPoolExecutor

CSV_PATH = "docs/examples/classroom-bridge-sync-units-only.csv"

def toggle_repo_actions(repo, enable):
    action_str = "enable" if enable else "disable"
    payload = {"enabled": True, "allowed_actions": "all"} if enable else {"enabled": False}
    payload_json = json.dumps(payload)
    
    cmd = [
        "gh", "api",
        "-X", "PUT",
        f"repos/{repo}/actions/permissions",
        "--input", "-"
    ]
    
    try:
        res = subprocess.run(cmd, input=payload_json, capture_output=True, text=True)
        if res.returncode == 0:
            print(f"  -> ✅ Successfully {action_str}d Actions for {repo}")
            return True, repo, None
        else:
            err = res.stderr.strip()
            print(f"  -> ❌ Failed to {action_str} Actions for {repo}: {err}")
            return False, repo, err
    except Exception as e:
        print(f"  -> ❌ Exception while toggling Actions for {repo}: {e}")
        return False, repo, str(e)

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ["--enable", "--disable"]:
        print("Usage: python3 scripts/toggle_actions.py [--enable | --disable]")
        sys.exit(1)
        
    enable = sys.argv[1] == "--enable"
    action_str = "ENABLING" if enable else "DISABLING"
    
    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    # Read unique template repositories from CSV
    repos = set()
    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            repo = row.get("template_repo")
            if repo:
                repos.add(repo)

    print(f"Starting to {action_str} GitHub Actions for {len(repos)} unique template repositories...\n")

    # Toggle in parallel using ThreadPoolExecutor
    success_count = 0
    failures = []
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(toggle_repo_actions, repo, enable) for repo in sorted(repos)]
        for future in futures:
            success, repo, err = future.result()
            if success:
                success_count += 1
            else:
                failures.append((repo, err))

    print("\n" + "="*40)
    print("Action Toggle Summary:")
    print(f"  Successfully toggled: {success_count}/{len(repos)}")
    print(f"  Failed:               {len(failures)}")
    if failures:
        print("Failures list:")
        for r, e in failures:
            print(f"  - {r}: {e}")
    print("="*40)

if __name__ == "__main__":
    main()
