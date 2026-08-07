---
name: feedback_a_rule_filed_under_its_consequence_never_fires
description: "A peer re-ran the `$? after a pipe` trap that was ALREADY in their own memory index. Cause: it was filed under 'exit codes' but the mistake happens while thinking about output size. File rules under the moment of the CAUSE."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

slang#9146 / PR #12379 (2026-08-06 23:36). slang-fixer reported `formatting.sh --check-only` was
**fail-open** — exiting 0 with formatters missing — which would have been a real bug in the repo's
tooling and invalidated every "formatting clean" they'd given me. **I could not reproduce it and asked
for shape invariants instead of asserting.** Their script was byte-identical to mine (447 lines, md5
`4578f1f6f00b5267c6f791bf43716e9a`) and the guard is fail-closed (`missing_bin=1` at `:169`,
`exit 1` at `:207-209`).

**The actual cause was none of my three hypotheses:**

```bash
./extras/formatting.sh --check-only 2>&1 | tail -12
echo "SCRIPT_EXIT=$?"        # ← $? is TAIL's status, not the script's
```

Reproduced myself, formatters hidden from `PATH`: piped → **0**, redirected → **1**,
`${PIPESTATUS[0]}` → **1**, and `set -o pipefail` → **1**. So the script is fail-closed and the
"fail-open" report was an artifact of reading `tail`'s exit status.

## ⭐⭐⭐ The reusable finding is not the trap — it is why a WRITTEN rule didn't fire

The `$?`-after-a-pipe trap was **already in the fixer's own memory index** (`MEMORY.md:49`, recorded
from a prior task where they hit the identical thing and published it as a learning). Having written
the rule did not stop them re-running it.

Their diagnosis, which is the part worth keeping: **`| tail` is a reflex for keeping output small, and
reading `$?` is a separate thought that arrives later.** The rule was filed under *exit codes*, but at
the moment of use they were thinking about *context budget*. **Knowledge filed under the consequence
does not get consulted while you are in the middle of the cause.**

⇒ **Re-file such rules as constraints on command SHAPE, checkable at typing time:** *"if a command's
exit code matters, it must not be piped — redirect, read the exit, then tail the file."* That is
verifiable while writing the pipe, which is the moment the mistake happens. Compare the useless form:
*"remember that `$?` after a pipe measures the last stage"* — true, filed correctly, and unreachable
from the keystroke that causes the error.

⇒ **Generalization for this whole store: a rule's index entry should name the ACTION THAT TRIGGERS IT,
not the phenomenon it explains.** If I would only search for it *after* suspecting the bug, it will not
fire. This is the retrieval-surface argument in the store's own writing rule, applied to *when* rather
than *what*.

## What survived the retraction — a better rule than the one retracted

The narrow finding stands: **the C++ arm genuinely never ran**, because `clang-format` was absent. The
script *said so on stderr* and was overlooked while trusting a bogus exit code. CI then failed on a
>100-column line.

⇒ **Gate on the per-language proof-of-run line, not on any exit code.** Verified the output shape:
present tools print `found <tool> <ver>, required [<min>, <max>)`; absent ones print
`This script needs <tool>, but it isn't in $PATH`. Green means *N `found` lines, zero `isn't in $PATH`,
zero diff lines* — and that rule holds **whether or not** the script is fail-closed, which is exactly
why it is the better rule. ⭐⭐ **A rule that does not depend on the disputed fact is worth more than
winning the dispute.**

⚠️ **My side of this, worth keeping: my hypothesis 2 was reasonable and wrong.** I guessed the
`((run_all || run_cpp)) && require_bin "clang-format"` scope gate at `:203` had left clang-format
unregistered. Plausible, mechanism-level, and not what happened. **Asking for two cheap shape invariants
settled it in one exchange where asserting would have cost rounds** — and per ANCHOR A I was one
confident inversion away from telling a peer their true-in-effect report ("C++ was never checked") was
false, when only its stated *mechanism* was wrong. See
[[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]] and
[[feedback_a_wildcard_export_claim_needs_the_link_not_the_file]].
