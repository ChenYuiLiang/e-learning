#!/usr/bin/env python3
import csv
import subprocess
import json
import sys
import os

CSV_PATH = "docs/examples/classroom-bridge-sync-units-only.csv"

def run_gh_api(args):
    cmd = ["gh", "api"] + args
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise Exception(f"gh api error: {res.stderr.strip()}")
    return json.loads(res.stdout)

def main():
    apply_mode = "--apply" in sys.argv
    print(f"Running migration script. Mode: {'APPLY' if apply_mode else 'DRY-RUN'}")
    if not apply_mode:
        print("To execute changes, run this script with the --apply flag.\n")

    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    # Read unique template repositories and branches from CSV
    repos = {}
    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            repo = row.get("template_repo")
            branch = row.get("template_branch", "main")
            if repo:
                repos[repo] = branch

    print(f"Found {len(repos)} unique template repositories to scan.\n")

    success_count = 0
    skipped_count = 0
    error_count = 0

    for idx, (repo, branch) in enumerate(repos.items(), 1):
        print(f"[{idx}/{len(repos)}] Processing {repo} (branch: {branch})...")
        
        # Check if a tutor-guide already exists in root
        root_guide = None
        try:
            root_guide = run_gh_api([f"repos/{repo}/contents/tutor-guide.md?ref={branch}"])
        except Exception:
            # Not found at root, which is expected before migration
            pass

        # Old paths to check in priority order
        old_paths = [".github/tutor_guide.md", ".github/tutor-guide.md", "tutor_guide.md"]
        found_old_path = None
        old_guide_data = None

        for path in old_paths:
            try:
                old_guide_data = run_gh_api([f"repos/{repo}/contents/{path}?ref={branch}"])
                found_old_path = path
                break
            except Exception:
                continue

        if not found_old_path:
            if root_guide:
                print(f"  -> Already migrated: tutor-guide.md exists in root. Old paths not found.")
                skipped_count += 1
            else:
                print(f"  -> Warning: No tutor guide found in any candidate path.")
                skipped_count += 1
            continue

        old_sha = old_guide_data["sha"]
        old_content_b64 = old_guide_data["content"].replace('\n', '').replace('\r', '')

        if root_guide:
            root_content_b64 = root_guide["content"].replace('\n', '').replace('\r', '')
            if root_content_b64 == old_content_b64:
                # Content matches, we just need to delete the leftover old path
                print(f"  -> tutor-guide.md at root matches {found_old_path}. Need to delete old path.")
                if apply_mode:
                    try:
                        # DELETE old file
                        run_gh_api([
                            "-X", "DELETE",
                            f"repos/{repo}/contents/{found_old_path}",
                            "-f", f"message=chore: remove legacy tutor-guide path ({found_old_path})",
                            "-f", f"sha={old_sha}",
                            "-f", f"branch={branch}"
                        ])
                        print(f"  -> ✅ Successfully deleted legacy path {found_old_path}.")
                        success_count += 1
                    except Exception as e:
                        print(f"  -> ❌ Error deleting legacy path: {e}")
                        error_count += 1
                else:
                    print(f"  -> [DRY-RUN] Would delete legacy path {found_old_path}.")
                    success_count += 1
                continue
            else:
                print(f"  -> tutor-guide.md exists in root but differs from {found_old_path}. Overwriting root with {found_old_path} content.")

        # Perform move/copy operation
        if apply_mode:
            try:
                # 1. Create or Overwrite tutor-guide.md in root
                put_args = [
                    "-X", "PUT",
                    f"repos/{repo}/contents/tutor-guide.md",
                    "-f", "message=chore: move tutor-guide.md to repository root",
                    "-f", f"content={old_content_b64}",
                    "-f", f"branch={branch}"
                ]
                if root_guide:
                    put_args.extend(["-f", f"sha={root_guide['sha']}"])
                
                run_gh_api(put_args)
                print(f"  -> ✅ Created/Updated tutor-guide.md at repository root.")

                # 2. Delete the old path
                run_gh_api([
                    "-X", "DELETE",
                    f"repos/{repo}/contents/{found_old_path}",
                    "-f", f"message=chore: delete legacy tutor-guide path ({found_old_path})",
                    "-f", f"sha={old_sha}",
                    "-f", f"branch={branch}"
                ])
                print(f"  -> ✅ Deleted legacy path {found_old_path}.")
                success_count += 1
            except Exception as e:
                print(f"  -> ❌ Error during migration: {e}")
                error_count += 1
        else:
            action_verb = "overwrite" if root_guide else "create"
            print(f"  -> [DRY-RUN] Would {action_verb} tutor-guide.md in root from {found_old_path} and delete {found_old_path}.")
            success_count += 1

    print("\n" + "="*40)
    print("Migration Summary:")
    print(f"  Success/Planned: {success_count}")
    print(f"  Skipped:         {skipped_count}")
    print(f"  Errors:          {error_count}")
    print("="*40)

if __name__ == "__main__":
    main()
