#!/usr/bin/env bash
# Report nv-main-owned files that a leaf branch AND nv-main both changed, where
# the leaf's change is not already contained in nv-main.
#
# WHY THIS EXISTS
#
# The composed state resolves every conflict in nv-main's owned set to nv-main
# (.github/workflows/ci.yml, setup/merge-train.sh, sync-upstream.sh). That is
# correct when the leaf's copy is merely stale. It is a SILENT LOSS when the leaf
# deliberately authored a change to an owned path: no conflict is reported, no
# check goes red, and the leaf's intent disappears at compose time.
#
# scripts/check-nv-owned-drift.sh answers "does this tree differ from nv-main",
# which catches the stale direction. Neither it nor the path guard answers "did
# BOTH sides author here, and is the leaf's work already upstream of the
# resolution". That is this script.
#
# CONTAINMENT, NOT ANCESTRY — the distinction that makes this useful
#
# The obvious test, "is the leaf's commit an ancestor of nv-main", answers
# whether nv-main MERGED that commit. It does not answer whether nv-main HAS the
# change. Both branches routinely implement the same feature independently, so
# the ancestry test reports a loss while the content is fully present. That
# produced a false alarm on 10 nv-dashboard files (sidebar_group,
# refreshDestinationsForAgentGroup, the ccusage pin, bot-contributions) where
# nv-main's version was a strict superset — including one case where nv-main's
# INSERT carried 12 columns against the leaf's 6.
#
# So: for each line the leaf added, ask whether nv-main's file contains it.
# Lines present ⇒ superseded, no loss. Lines absent ⇒ report for review. This is
# a heuristic and says so: a reordered or refactored equivalent reads as absent.
# It is a review prompt, never an automatic verdict.
#
# Usage:
#   bash scripts/check-both-sides-authored.sh <leaf-branch> [--ref <nv-main-ref>]
#   bash scripts/check-both-sides-authored.sh nv-dashboard
#
# Exit codes:
#   0  no unabsorbed both-sides-authored changes
#   1  findings to review
#   2  preflight failure (bad ref, missing allowlist/matcher) — never a green

set -euo pipefail

LEAF="${1:-}"
NV_REF="origin/nv-main"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) NV_REF="${2:?--ref needs a value}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$LEAF" ]; then
  echo "usage: check-both-sides-authored.sh <leaf-branch> [--ref <nv-main-ref>]" >&2
  exit 2
fi

LEAF_REF="$LEAF"
git rev-parse --verify --quiet "$LEAF_REF" >/dev/null 2>&1 || LEAF_REF="origin/$LEAF"

# FAIL CLOSED. Every input is checked up front: a check that reports success
# when it could not run is worse than no check.
for ref in "$LEAF_REF" "$NV_REF"; do
  git rev-parse --verify --quiet "$ref" >/dev/null 2>&1 || {
    echo "::error::cannot resolve ref '$ref'" >&2; exit 2; }
done

# Ownership comes from the trusted ref, never the tree being judged: a stale or
# tampered in-tree matcher could answer "nothing is owned" and print a green it
# did not earn. Same rule as scripts/check-nv-owned-drift.sh.
MATCHER=$(mktemp); ALLOW=$(mktemp); OWNED=$(mktemp); CAND=$(mktemp)
trap 'rm -f "$MATCHER" "$ALLOW" "$OWNED" "$CAND"' EXIT

git show "$NV_REF:.github/nv-path-guard/ownership.py" > "$MATCHER" 2>/dev/null || {
  echo "::error::cannot read ownership.py from $NV_REF" >&2; exit 2; }
git show "$NV_REF:.github/nv-path-guard/nv-main.txt" > "$ALLOW" 2>/dev/null || {
  echo "::error::cannot read nv-main.txt from $NV_REF" >&2; exit 2; }

MB=$(git merge-base "$LEAF_REF" "$NV_REF") || {
  echo "::error::no merge base between $LEAF_REF and $NV_REF" >&2; exit 2; }

# Candidates: changed on BOTH sides since the merge base. A file only the leaf
# touched is not at risk (nothing overwrites it); a file only nv-main touched is
# the stale direction the existing drift check already covers.
comm -12 \
  <(git diff --name-only "$MB" "$LEAF_REF" | sort) \
  <(git diff --name-only "$MB" "$NV_REF" | sort) > "$CAND"

python3 "$MATCHER" "$ALLOW" < "$CAND" > "$OWNED" || {
  echo "::error::ownership matcher failed — refusing to report a green" >&2; exit 2; }

echo "leaf=$LEAF_REF  canonical=$NV_REF  merge-base=${MB:0:9}"
echo "changed on both sides: $(grep -c . "$CAND" || true)   of those nv-main-owned: $(grep -c . "$OWNED" || true)"
echo

FINDINGS=0
while read -r f; do
  [ -z "$f" ] && continue
  # A file the leaf deleted and nv-main kept, or vice versa: report rather than
  # guess, since line containment is meaningless for a deletion.
  if ! git cat-file -e "$LEAF_REF:$f" 2>/dev/null; then
    echo "  DELETED-ON-LEAF  $f  (nv-main still has it — confirm the deletion was intended)"
    FINDINGS=$((FINDINGS + 1))
    continue
  fi
  git cat-file -e "$NV_REF:$f" 2>/dev/null || continue

  total=0; missing=0; samples=""
  while IFS= read -r line; do
    body="${line:1}"
    [ -z "$(printf '%s' "$body" | tr -d '[:space:]')" ] && continue
    total=$((total + 1))
    if ! git show "$NV_REF:$f" | grep -qF -- "$body"; then
      missing=$((missing + 1))
      [ ${#samples} -lt 160 ] && samples="$samples
        - ${body:0:100}"
    fi
  done < <(git diff "$MB" "$LEAF_REF" -- "$f" | grep '^+' | grep -v '^+++')

  if [ "$missing" -gt 0 ]; then
    echo "  REVIEW  $f  ($missing/$total leaf-added line(s) not found in $NV_REF)$samples"
    FINDINGS=$((FINDINGS + 1))
  fi
done < "$OWNED"

if [ "$FINDINGS" -eq 0 ]; then
  echo "no unabsorbed both-sides-authored changes: every leaf-added line is already in $NV_REF."
  exit 0
fi

cat <<EOF

$FINDINGS file(s) to review. The composed state resolves nv-main-owned paths to
$NV_REF, so anything genuinely missing above is dropped at compose time.

Port it onto nv-main, or confirm nv-main's version supersedes it. Line
containment is a heuristic — a refactored equivalent reads as missing, so read
the diff before acting:

  git diff $NV_REF:<file> $LEAF_REF:<file>
EOF
exit 1
