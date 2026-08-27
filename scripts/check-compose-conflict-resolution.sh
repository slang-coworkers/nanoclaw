#!/usr/bin/env bash
# Guards the conflict-resolution loop that three separate compose paths share:
#   .github/workflows/ci.yml   (composed CI)
#   setup/merge-train.sh       (project overlay compose)
#   setup.sh                   (fresh-clone bootstrap)
#
# All three canonicalize an owned-path conflict to nv-main, and all three must
# survive a MODIFY/DELETE conflict — the case where nv-main deleted the file and
# the overlay edited it, so there is no blob to check out. That case shipped
# broken in all three for months: it is only reachable when a merge-base move
# turns a clean delete into a modify/delete, which first happened when the
# upstream sync landed (PR #1138, run 32995836470, `exit 128`).
#
# The trap is that `git rm -f` SUCCEEDS here and stages the deletion, so a
# following `git add -A -- "$f"` runs on a path absent from both worktree and
# index. Git calls that fatal (`pathspec did not match any files`, exit 128),
# not a no-op — and every one of the three runs under `set -e`.
#
# So this asserts the behaviour, not the text: it builds a real modify/delete
# conflict and runs each script's actual loop body under `bash -e`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fails=0

# A repo where `master` deleted d/f.ts and `other` modified it, mid-merge with
# d/f.ts unmerged. The sibling d/keep.ts must survive: an over-broad fix that
# removes the parent directory would still pass without it.
make_conflict() {
  local dir="$1"
  rm -rf "$dir" && mkdir -p "$dir"
  git -C "$dir" init -q .
  git -C "$dir" config user.email compose-test@nanoclaw
  git -C "$dir" config user.name compose-test
  mkdir -p "$dir/d"
  printf 'base\n' >"$dir/d/f.ts"
  printf 'keep\n' >"$dir/d/keep.ts"
  git -C "$dir" add -A
  git -C "$dir" commit -qm base
  git -C "$dir" checkout -q -b other
  printf 'overlay edit\n' >"$dir/d/f.ts"
  git -C "$dir" commit -qam modify
  git -C "$dir" checkout -q master
  git -C "$dir" rm -q d/f.ts
  git -C "$dir" commit -qm delete
  git -C "$dir" checkout -q other
  git -C "$dir" merge master >/dev/null 2>&1 || true
}

# Extract the `else` branch of the checkout/rm resolution from a script and run
# it against the fixture, so the test tracks the shipped code rather than a
# copy of it that can drift.
check_script() {
  local label="$1" file="$2"
  local body
  # Extract EVERY executable line of the deletion branch, from the `git rm` to
  # the closing `fi` — not just the first. The historical bug was a SECOND line
  # (`git add -A -- "$f"`) after a `git rm` that already succeeded, so a
  # first-line-only extraction cannot see it and the test would pass against
  # the very code it exists to reject. Comments are dropped so prose mentioning
  # a git command is never executed.
  body="$(sed 's/^[[:space:]]*//' "$ROOT/$file" |
    sed -n '/^git rm -f -- "\$f"/,/^fi$/p' |
    grep -vE '^(#|fi$)' |
    grep -E '.')"
  if ! grep -q 'git rm -f' <<<"$body"; then
    echo "FAIL $label: could not locate the resolution block in $file — did it move?"
    fails=$((fails + 1))
    return
  fi

  local work="/tmp/compose-conflict-$label"
  make_conflict "$work"
  if ! git -C "$work" diff --name-only --diff-filter=U | grep -q 'd/f.ts'; then
    echo "FAIL $label: fixture did not produce an unmerged d/f.ts"
    fails=$((fails + 1))
    return
  fi

  # `bash -e` mirrors ci.yml's shell and setup.sh's `set -euo pipefail`: the
  # bug is fatal only because the non-zero exit aborts the enclosing script.
  # The subshell shares $work, so the staged resolution outlives it.
  if ! bash -e -c "cd '$work'; f=d/f.ts; $body"; then
    echo "FAIL $label ($file): resolving a modify/delete conflict exits non-zero"
    echo "     line under test: $body"
    fails=$((fails + 1))
    rm -rf "$work"
    return
  fi

  if ! git -C "$work" commit --no-edit -q; then
    echo "FAIL $label: merge left an unresolved path — commit refused"
    fails=$((fails + 1))
  elif [ -e "$work/d/f.ts" ]; then
    echo "FAIL $label: deletion was not honored — d/f.ts still present"
    fails=$((fails + 1))
  elif [ ! -e "$work/d/keep.ts" ]; then
    echo "FAIL $label: resolution removed the sibling d/keep.ts"
    fails=$((fails + 1))
  else
    echo "ok   $label ($file)"
  fi
  rm -rf "$work"
}

check_script ci .github/workflows/ci.yml
check_script merge-train setup/merge-train.sh
check_script bootstrap setup.sh

if [ "$fails" -ne 0 ]; then
  echo "::error::$fails compose path(s) cannot resolve a modify/delete conflict"
  exit 1
fi
echo "All compose paths resolve modify/delete conflicts."
