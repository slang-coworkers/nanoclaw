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
# EVERYTHING THAT DECIDES THE ANSWER COMES FROM THE TRUSTED REF
#
# The allowlist AND the matcher that reads it are both extracted from one
# resolved commit, and the ref is pinned to that exact SHA up front so a
# concurrent fetch cannot move it between the checks and the comparison. A
# verifier that loads its own matcher from the worktree it is judging can be
# handed a matcher that answers "nothing is owned" — and would then print a
# green it did not earn, with its own tampering invisible. The candidate list
# excludes only `*.txt` ownership DATA for that reason: `ownership.py` and
# `check.py` are executables, and they are drift-checked like any other file.
#
# Usage:
#   bash scripts/check-nv-owned-drift.sh                 # check vs origin/nv-main
#   bash scripts/check-nv-owned-drift.sh --ref <ref>     # check vs another ref
#   bash scripts/check-nv-owned-drift.sh --allow <file>  # treat as a deliberate
#                                                        # local mod (repeatable)
#   NV_DRIFT_ALLOW="a.ts b.ts" bash scripts/check-nv-owned-drift.sh
#
# FAILS CLOSED. Every input this needs to answer the question is checked up
# front: the ref, nv-main's allowlist on that ref, and the shared matcher from
# that same ref. If any is missing the answer is exit 2, never a green "ok". A
# safety check that reports success when it could not run is worse than no check
# — it is a check everyone believes.
#
# Exit codes:
#   0  no drift
#   1  drift found — owned files differ from <ref> and are not allowlisted
#   2  usage / preflight failure (including: cannot determine ownership)

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
      # Print the leading comment block, whatever length it happens to be — a
      # hardcoded line range silently truncates the help the moment this header
      # is edited.
      awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
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

# Pin the trusted base to an immutable commit ONCE. `origin/nv-main` is a moving
# target: a background fetch between the allowlist read and the diff would mean
# the matcher, the allowlist and the comparison came from different trees.
if ! REF_SHA="$(git rev-parse --verify --quiet "${REF}^{commit}")"; then
  echo "::error::$REF is not available locally — there is nothing to compare against, so" >&2
  echo "this check cannot tell you whether anything drifted. Fetch it and re-run:" >&2
  echo "  git fetch origin nv-main" >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
OWNED_LIST="$WORK/nv-main.txt"
MATCHER="$WORK/ownership.py"

# Ownership DATA comes from the SAME single source of truth setup.sh and
# merge-train.sh use: nv-main's path-guard allowlist, read from the pinned
# commit rather than the worktree — a silently-reverted allowlist must not get a
# say in judging itself.
if ! git show "$REF_SHA:.github/nv-path-guard/nv-main.txt" >"$OWNED_LIST" 2>/dev/null; then
  echo "::error::no .github/nv-path-guard/nv-main.txt on $REF — ownership is undeterminable." >&2
  echo "Without it every path would be judged unowned and this check would report a green" >&2
  echo "it did not earn. Fetch a $REF that carries the allowlist and re-run." >&2
  exit 2
fi
if ! grep -qEv '^[[:space:]]*(#|$)' "$OWNED_LIST"; then
  echo "::error::$REF's .github/nv-path-guard/nv-main.txt has no patterns — nv-main would" >&2
  echo "own nothing and every comparison would trivially pass." >&2
  exit 2
fi

# Ownership MATCHING is the shared matcher CI's path-guard uses
# (.github/nv-path-guard/check.py imports the same module), and it is taken from
# the SAME pinned commit as the allowlist. Resolving it from the worktree would
# let the tree under test supply the code that judges it: a matcher stubbed to
# print nothing turns every run green, and because the matcher was itself
# excluded from the candidate list, that edit was never reported either.
if ! git show "$REF_SHA:.github/nv-path-guard/ownership.py" >"$MATCHER" 2>/dev/null; then
  echo "::error::no .github/nv-path-guard/ownership.py on $REF — there is no trusted matcher" >&2
  echo "to evaluate ownership with, and the worktree's copy is exactly what this check is" >&2
  echo "supposed to be judging. Fetch a $REF that carries it and re-run." >&2
  exit 2
fi
command -v python3 >/dev/null 2>&1 || {
  echo "::error::python3 not found — required to evaluate ownership with CI's matcher." >&2
  exit 2
}

is_allowed() {
  local f="$1" a
  for a in ${ALLOW+"${ALLOW[@]}"}; do
    [ "$f" = "$a" ] && return 0
  done
  return 1
}

# NUL-delimited from here to the matcher and back: a path may legally contain a
# newline, and `git diff --name-only` without -z C-quotes those into a different
# string that then silently matches nothing.
CANDIDATES="$WORK/candidates"
: >"$CANDIDATES"
while IFS= read -r -d '' f; do
  [ -z "$f" ] && continue
  # The path-guard allowlists are ownership METADATA, not code. Each branch
  # legitimately carries its own (nv-main.txt vs nv-slang.txt, and nv-main's own
  # copy evolves as it absorbs upstream paths), so a difference here is normal
  # branch shape rather than the silent-revert this check exists to find.
  # ONLY the `.txt` data is exempt: ownership.py and check.py in the same
  # directory are executables, and a stale or tampered copy of either is exactly
  # the drift most worth hearing about.
  case "$f" in
    .github/nv-path-guard/*.txt) continue ;;
  esac
  printf '%s\0' "$f" >>"$CANDIDATES"
done < <(git diff --name-only -z "$REF_SHA" HEAD)

# One batch call: the matcher's answer, or no answer at all.
OWNED="$WORK/owned"
if ! python3 "$MATCHER" -0 "$OWNED_LIST" <"$CANDIDATES" >"$OWNED"; then
  echo "::error::could not evaluate ownership — refusing to report a result." >&2
  exit 2
fi

drift=()
allowed=()
while IFS= read -r -d '' f; do
  [ -z "$f" ] && continue
  # Only files that EXIST on the ref can have been reverted against it. Files
  # absent there are the overlay's own additions — legitimately local.
  git cat-file -e "$REF_SHA:$f" 2>/dev/null || continue
  if is_allowed "$f"; then
    allowed+=("$f")
  else
    drift+=("$f")
  fi
done <"$OWNED"

if [ ${#allowed[@]} -gt 0 ]; then
  echo "Allowlisted local mods (not drift):"
  for f in "${allowed[@]}"; do echo "  $f"; done
  echo
fi

if [ ${#drift[@]} -eq 0 ]; then
  echo "ok: no nv-main-owned file differs from $REF ($REF_SHA)."
  exit 0
fi

echo "::error::${#drift[@]} nv-main-owned file(s) differ from $REF ($REF_SHA):"
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
