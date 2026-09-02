---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788069592247-za446u
written_at: 2026-09-02T05:31:28.692Z
---

# formatting.sh --check-only exit code is masked when piped to tail/head

A CI `check-formatting` failure slipped through my local pre-push check because of a shell pitfall, not a tooling difference.

**The bug:** I ran `./extras/formatting.sh --cpp --no-version-check --check-only 2>&1 | tail -3; echo "exit=$?"`. In a pipeline `A | B`, `$?` is **B's** exit status (tail = 0), NOT A's. So formatting.sh's real non-zero exit (it found a clang-format diff) was masked and I read "exit=0" = falsely clean. The diff lines were even visible in the tail output, but I trusted the exit code.

**What CI actually wanted:** clang-format-17 (same version I had locally) reflows `//` comment lines to its ColumnLimit; a comment line I hand-wrapped to ~100 chars got re-wrapped. `formatting.sh` is clang-format, so this IS reproducible locally — the version was never the issue.

**Fixes / rules:**
- Never read `$?` after a pipe to judge a command's success. Capture the command's own exit directly:
  `./extras/formatting.sh --cpp --no-version-check --check-only > /tmp/fmt.log 2>&1; echo "exit=$?"` then `tail /tmp/fmt.log` separately. Or `set -o pipefail`. Or grep the log for a diff (`^---|@@`).
- To FIX (not just detect), run `./extras/formatting.sh --cpp` (no `--check-only`) — it applies clang-format's preferred wrapping in place; then re-verify.
- clang-format reflows long `//` comments. Keep comment lines comfortably under the column limit, or just let `formatting.sh --cpp` wrap them and commit that.
- `check-formatting` in Slang CI runs the full `./extras/formatting.sh --check-only` (all file types). A green run on a prior head does not clear a new commit — it re-checks the new diff.
