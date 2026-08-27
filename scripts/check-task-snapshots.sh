#!/usr/bin/env bash
# check-task-snapshots — CI wiring for `dump-scheduled-tasks.py --check`.
#
# The committed scheduled-task snapshot is a PAIR: `docs/scheduled-tasks.<slug>.json`
# and its Markdown sibling, both stamped with the same `snapshot_id` (a content hash of
# the JSON). The pair can come apart in two ways no reviewer would notice — a crash
# between the two renames, which no in-process rollback can cover, and a hand-edit of a
# committed file. Either leaves a snapshot that still LOOKS authoritative, which is the
# stale-authority problem the artifact exists to prevent.
#
# `--check` reads the two files and nothing else — it returns before `ncl` is ever
# invoked — so it needs no live host, no DB, and no network. That is what makes it
# runnable here at all.
#
# Usage: check-task-snapshots.sh [<tree>]     (default: the repo this script lives in)
#
# Exits non-zero if ANY snapshot is inconsistent. Every snapshot is checked before
# exiting, so one bad file does not hide the next.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUMP="$HERE/dump-scheduled-tasks.py"
ROOT="${1:-$(cd "$HERE/.." && pwd)}"

[ -f "$DUMP" ] || { echo "::error::$DUMP not found"; exit 2; }

shopt -s nullglob
snapshots=("$ROOT"/docs/scheduled-tasks.*.json)
shopt -u nullglob

# A glob that matches nothing runs an empty loop and falls through to `exit 0`, which
# in a CI log is indistinguishable from a green check. Deleting the snapshot would then
# silence the drift alarm AND keep the build green — so say plainly that this run
# verified nothing. Not a hard failure: `main` has never carried a snapshot, and a PR
# there must not go red over an artifact that branch does not publish.
if [ ${#snapshots[@]} -eq 0 ]; then
  echo "::warning::no docs/scheduled-tasks.*.json in $ROOT — this check verified NOTHING."
  echo "no docs/scheduled-tasks.*.json snapshots found; nothing was verified."
  echo "If this branch is supposed to publish one, it has gone missing."
  exit 0
fi

failed=0
for json in "${snapshots[@]}"; do
  md="${json%.json}.md"
  echo "--- checking ${json#"$ROOT"/} + ${md#"$ROOT"/}"
  # `--md` is passed UNCONDITIONALLY, including when the file is absent. Passing it only
  # when it exists would quietly drop the cross-file comparison in exactly the case a
  # publish had half-landed; a JSON with no Markdown sibling is a torn pair, not a
  # JSON-only snapshot, and must be reported as one.
  #
  # The status is captured on its own line: inside `if ! cmd; then`, `$?` is the status
  # of the negation (always 0), so reporting it there would print "exit 0" on failure.
  python3 "$DUMP" --check --out "$json" --md "$md"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "::error file=${json#"$ROOT"/}::snapshot check failed (exit $rc) — the committed pair does not agree with itself. Re-run scripts/dump-scheduled-tasks.py against the live host and commit both files."
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi
echo "OK: ${#snapshots[@]} snapshot(s) consistent with their Markdown mirrors."
