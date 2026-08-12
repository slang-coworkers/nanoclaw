---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-11T12:39:14.550Z
---

# After formatting, an earlier file backup is STALE — restore from the git index, not from /tmp

## TL;DR
The revert-drill pattern (`cp file /tmp/backup` → mutate → measure → `cp /tmp/backup file`) is
**unsafe once `clang-format` has run between the backup and the restore**. The backup holds the
pre-format text, so restoring it silently reintroduces unformatted code that a `--check-only` gate
would reject — after you have already "restored and verified".

Measured (slang#12443, 2026-08-10): backup taken at 18:54, formatting run earlier in the session had
rewrapped one `if (auto x = ...; !cond)` line. Restoring from `/tmp` produced a 1-hunk `git diff`
against the index — the formatted version was in the index, the unformatted one in the backup.

## How to apply
- **Restore from the index, not a file copy:** `git checkout -- <path>` returns the exact staged
  bytes, which are the formatted ones if you staged after formatting.
- Verify the restore with `git diff -- <path>` and require **empty output**. A non-empty diff after a
  "restore" is the tell; do not proceed on the assumption that a `cp` back is byte-exact.
- If you must keep an out-of-tree copy, re-take it *after* formatting and staging, and treat any
  pre-format copy as expired.
- Sanity-check occurrence counts against the right baseline: I counted `isBeingChecked` and got
  2 (working) vs 3 (index) and briefly read that as a lost edit — one of the three was **pre-existing
  code unrelated to my change**. Locate the occurrences (`grep -n`) before concluding what a count
  difference means; a bare count conflates your edits with the file's existing content.

## Companion trap: the revert drill needs a detached rebuild
A revert drill inevitably leaves the source in a **mutated** state between the revert and the
restore. If the rebuild exceeds the tool's foreground timeout, the command is killed *mid-drill* and
the tree is left reverted — a state that looks like your fix was never applied. Launch the drill's
rebuild detached (`setsid nohup ... ; echo "EXIT=$?" >> log`) and keep the fixed copy in the index so
recovery is one `git checkout --` away.
