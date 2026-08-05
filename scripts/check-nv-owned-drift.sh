#!/usr/bin/env bash
# Verify-only drift check for nv-main-owned files.
#
# WHY THIS EXISTS
#
# `setup.sh` (compose_fork) and `setup/merge-train.sh` both already restore
# nv-main-owned files that an overlay merge silently reverted — the failure mode
# where an overlay's STALE copy of a nv-main-owned file AUTO-merges (no conflict,
# no prompt) and then dangles against nv-main's evolved code. That is the
# `dependsOn`/`TS2353` and `create-agent.ts`/`TS2740` class of break.
#
# But both run that sweep only as PART OF A MERGE. compose_fork returns early
# when nv-main is already merged, and merge-train sweeps only branches it just
# merged. So a tree that was merged BY HAND — or one being inspected after the
# fact — has no way to ask "is anything nv-main owns silently diverged here?".
# That is the gap this fills: same ownership source, same comparison, no writes.
#
# It never modifies the tree. It prints what to run.
#
# Usage:
#   bash scripts/check-nv-owned-drift.sh                 # check vs origin/nv-main
#   bash scripts/check-nv-owned-drift.sh --ref <ref>     # check vs another ref
#   bash scripts/check-nv-owned-drift.sh --allow <file>  # treat as a deliberate
#                                                        # local mod (repeatable)
#   NV_DRIFT_ALLOW="a.ts b.ts" bash scripts/check-nv-owned-drift.sh
#
# Exit codes:
#   0  no drift (or nothing to compare against)
#   1  drift found — owned files differ from <ref> and are not allowlisted
#   2  usage / preflight failure

set -euo pipefail

REF="origin/nv-main"
ALLOW=()

while [ $# -gt 0 ]; do
  case "$1" in
    --ref)
      [ $# -ge 2 ] || { echo "--ref needs a value" >&2; exit 2; }
      REF="$2"; shift 2 ;;
    --allow)
      [ $# -ge 2 ] || { echo "--allow needs a value" >&2; exit 2; }
      ALLOW+=("$2"); shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *)
      echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Space-separated env allowlist composes with repeated --allow.
if [ -n "${NV_DRIFT_ALLOW:-}" ]; then
  # shellcheck disable=SC2206
  ALLOW+=(${NV_DRIFT_ALLOW})
fi

command -v git >/dev/null 2>&1 || { echo "::error:: git not found" >&2; exit 2; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "::error:: not a git repo" >&2; exit 2; }

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

if ! git rev-parse --verify --quiet "$REF" >/dev/null; then
  echo "$REF is not available locally — nothing to compare against (try: git fetch origin nv-main)."
  exit 0
fi

# Ownership comes from the SAME single source of truth setup.sh and
# merge-train.sh use: nv-main's path-guard allowlist, matched with git's own
# gitignore engine (the gitwildmatch syntax .github/nv-path-guard/check.py
# uses). Read it from the REF, not the worktree — a silently-reverted allowlist
# would otherwise get a say in judging itself.
OWNED_LIST="$(mktemp)"
trap 'rm -f "$OWNED_LIST"' EXIT
if ! git show "$REF:.github/nv-path-guard/nv-main.txt" >"$OWNED_LIST" 2>/dev/null; then
  echo "No .github/nv-path-guard/nv-main.txt on $REF — cannot determine ownership; skipping."
  exit 0
fi

is_owned() {
  git -c core.excludesFile="$OWNED_LIST" check-ignore --no-index -q -- "$1"
}

is_allowed() {
  local f="$1" a
  for a in ${ALLOW+"${ALLOW[@]}"}; do
    [ "$f" = "$a" ] && return 0
  done
  return 1
}

drift=()
allowed=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  # The path-guard allowlists are ownership METADATA, not code. Each branch
  # legitimately carries its own (nv-main.txt vs nv-slang.txt, and nv-main's own
  # copy evolves as it absorbs upstream paths), so a difference here is normal
  # branch shape rather than the silent-revert this check exists to find.
  # Reporting it would fire on every overlay and train the reader to ignore
  # output that matters.
  case "$f" in
    .github/nv-path-guard/*) continue ;;
  esac
  is_owned "$f" || continue
  # Only files that EXIST on the ref can have been reverted against it. Files
  # absent there are the overlay's own additions — legitimately local.
  git cat-file -e "$REF:$f" 2>/dev/null || continue
  if is_allowed "$f"; then
    allowed+=("$f")
  else
    drift+=("$f")
  fi
done < <(git diff --name-only "$REF" HEAD)

if [ ${#allowed[@]} -gt 0 ]; then
  echo "Allowlisted local mods (not drift):"
  for f in "${allowed[@]}"; do echo "  $f"; done
  echo
fi

if [ ${#drift[@]} -eq 0 ]; then
  echo "ok: no nv-main-owned file differs from $REF."
  exit 0
fi

echo "::error::${#drift[@]} nv-main-owned file(s) differ from $REF:"
for f in "${drift[@]}"; do echo "  $f"; done
cat <<EOF

$REF is canonical for these paths. A difference here is usually a SILENT REVERT:
an overlay's stale copy auto-merged (no conflict, no prompt) and now dangles
against $REF's evolved code — the class of break that shows up later as a
tsc error, not as a merge failure.

Restore the ones that are not deliberate local modifications:

  git checkout $REF -- <file>

For a genuine local modification, re-run with --allow <file> (repeatable) or
NV_DRIFT_ALLOW="<file> <file>" so this check stays green and the intent is
recorded in the command rather than in someone's memory.

Do NOT blanket-restore a whole directory — that wipes deliberate local wiring.
EOF
exit 1
