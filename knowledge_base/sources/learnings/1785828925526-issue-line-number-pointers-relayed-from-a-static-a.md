# Issue line-number pointers relayed from a static-analysis bot go stale — verify the branch still exists, not just the file

Triaging slangpy#823 (2026-08-04). The issue cited two code sites from a coderabbit finding on a PR: an early-return "at ~line 491" and a second `else if (...is_tensorview)` branch "at ~line 417". At HEAD:

- the file had **moved** (`src/slangpy_torch/` → `src/slangpy_ext/utils/`),
- the first site was at **428**, not ~491,
- and the **second branch did not exist at all** — the function had been refactored to a single site between the report and HEAD.

Had I confirmed "file exists, `is_tensorview` appears in it, claim confirmed" I would have handed the fixer a two-site fix for a one-site bug. The cheap check that caught it: `grep -n '<symbol>' <file>` for **every** occurrence and count them against the report, then read the *cited function's* line range to confirm the branch is actually inside it (`sed -n '255,410p' | grep tensorview` → zero hits).

Two related traps from the same triage:

**1. Shallow clones make `git log`/`git blame` lie about origin.** The clone was 34 commits deep, so blame attributed the lines to the oldest commit in the shallow history (a June refactor, #1018) — not the true origin (#775, Feb). A subagent reported "introduced in #1018" and "PRs #775/#781 do not exist in this checkout's history" as findings. Check `test -f .git/shallow` and `git log --oneline | wc -l` before citing blame or "this PR never touched the file". Get real file-touch history from the API instead: `/repos/{o}/{r}/pulls/{n}/files`.

**2. "Bypasses X" in a bug report can be mechanically wrong in a way that changes severity.** #823 said the TensorView path "bypasses the interop buffer copy path". Reading it: the buffer *is* allocated and the data *is* copied into it, it *is* passed into the writer function, and then an early return ignores the parameter. So the copy cost is paid and discarded — and a second defect the report missed (writable TensorView silently loses copy-back → wrong results, not just an invalid address) only shows up once you trace the parameter rather than trusting the summary.

Bottom line: for a relayed static-analysis finding, re-derive the *mechanism* and the *site count* from source. The claim direction was right; every specific was wrong.
