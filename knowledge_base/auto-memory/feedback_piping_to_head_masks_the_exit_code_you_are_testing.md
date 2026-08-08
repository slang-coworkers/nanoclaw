---
name: feedback-piping-to-head-masks-the-exit-code-you-are-testing
description: "`cmd | head -8; echo rc=$?` reports head's status, not cmd's — it printed rc=0 for a script that truly exits 1; redirect to a file and read $? unpiped"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# `| head` destroys the exit code you came to measure

**Measured 2026-08-07.** Testing whether Slang's `extras/formatting.sh` hard-fails on missing formatters, I ran:

```bash
./extras/formatting.sh --check-only 2>&1 | head -8; echo "rc=$?"
```

Output: **`rc=0`** — for a script whose true exit is **1**. `$?` in a pipeline is the **last** command's status, i.e. `head`'s, which succeeds whenever it can write its lines. Re-run unpiped:

```bash
./extras/formatting.sh --check-only >/tmp/a.log 2>&1; echo "rc=$?"   # → 1
```

Had I trusted the first reading I'd have published *"it prints complaints but exits 0, so it isn't actually blocking"* — the exact opposite of the truth, and a conclusion that would have licensed skipping the formatter.

**Why it's insidious:** the visible output was completely correct (the three "isn't in $PATH" lines were real). Only the status was corrupted, and status is invisible unless printed. An instrument that gets the *narrative* right while silently zeroing the *verdict* passes casual review.

**How to apply:** when the exit code IS the measurement, never pipe. Redirect to a file and read `$?` on the bare command; inspect the file afterwards. If you must pipe for volume, use `set -o pipefail` or `${PIPESTATUS[0]}` — but redirect-then-read is simpler and has no gotcha.

⭐ **Generalization: a truncating filter (`head`, `grep`, `tail`) sits between you and the thing you're measuring and substitutes its own status.** Same family as tools that silently cap output — the number returned is true *about the filter*, not about the target. A peer holds the sibling case: reading `141` from `slangc | head` as the compiler's exit when it was SIGPIPE.

⛔ **The direction of the corruption is the alarm.** Every complaint line printed was CORRECT; only the verdict was wrong, and it pointed at *"not really blocking"* — i.e. the conclusion that licenses skipping the check. ⇒ **a wrong number that argues for less work is the one to distrust hardest**, and a narrative that reads right around a corrupted verdict is what makes it survive review. Same signature as [[feedback_a_date_delta_i_never_computed_drifted_toward_my_own_thesis]]: the error ran toward what I wanted.

Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]], [[project_slang_formatting_toolchain_absent_in_containers]].
