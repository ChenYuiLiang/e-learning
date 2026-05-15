#!/usr/bin/env bash
set -euo pipefail

# Rewrite template_repo org in bridge sync CSV.
# Usage:
#   scripts/rewrite_template_org_in_csv.sh <csv_path> <new_org> [output_csv]
# Example:
#   scripts/rewrite_template_org_in_csv.sh docs/examples/classroom-bridge-sync-units-only.csv vibe-coding-template

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <csv_path> <new_org> [output_csv]" >&2
  exit 1
fi

CSV_PATH="$1"
NEW_ORG="$2"
OUT_PATH="${3:-$CSV_PATH}"

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 1
fi

TMP_FILE="$(mktemp)"

awk -F',' -v OFS=',' -v new_org="$NEW_ORG" '
NR==1 { print; next }
{
  # col2 is template_repo: org/repo
  n=split($2, parts, "/")
  if (n >= 2) {
    repo=parts[2]
    for (i=3; i<=n; i++) repo=repo "/" parts[i]
    $2 = new_org "/" repo
  }
  print
}
' "$CSV_PATH" > "$TMP_FILE"

mv "$TMP_FILE" "$OUT_PATH"

echo "Rewritten template_repo org to '$NEW_ORG'"
echo "Output: $OUT_PATH"
