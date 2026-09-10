---
name: feedback_rev_path_reads_need_a_presence_gate
description: "git rev-parse <rev>:<path> on a missing path prints the argument string to stdout, so comparing two absent paths across revs yields two different strings and reads as CHANGED. Gate every rev:path read on git cat-file -e and classify absence explicitly. Measured: 7 phantom fork edits on nanoclaw#1185."
metadata:
  node_type: memory
  type: feedback
  originSessionId: bc9dbdbe-95ac-471c-9606-5165681f3bb8
---

# A `rev:path` read needs a presence gate, or absence reads as change

**Trigger — any loop that compares a file across two git revs by capturing
`$(git rev-parse "$rev:$path")` or `$(git show "$rev:$path")` into a shell variable.**

## What happened

Auditing whether an upstream-sync PR (slang-coworkers/nanoclaw#1185) smuggled fork-side edits, I
ran a census over the 19 touched files:

```bash
b=$(git rev-parse "$base:$f" 2>/dev/null)      # WRONG
l=$(git rev-parse "$lastsync:$f" 2>/dev/null)
[ "$b" != "$l" ] && echo "FORK_EDIT_SINCE_LAST_SYNC: $f"
```

It reported **7 fork edits**. All 7 were files that upstream had just *created* — absent at both
revs. `git rev-parse` on a missing `rev:path` **echoes its own argument to stdout** (and exits
non-zero), so the captured values were the literal strings
`a095beb50:src/host-lifecycle.ts` and `743e32df:src/host-lifecycle.ts` — **different, because the
rev prefix differs.** Absent-vs-absent compared as changed, for every new file.

⚠️ `2>/dev/null` makes this worse, not better: it hides `fatal: path ... does not exist`, which is
the only signal that the read failed. The variable still holds a plausible-looking string.

## The fix

Gate on presence, then classify the absent case as its own outcome — never fold it into
"changed" or "unchanged":

```bash
blob() { git cat-file -e "$1:$2" 2>/dev/null && git rev-parse "$1:$2" || echo ABSENT; }
b=$(blob "$base" "$f"); l=$(blob "$lastsync" "$f")
if   [ "$b" = ABSENT ] && [ "$l" = ABSENT ]; then echo "NEW_FROM_ELSEWHERE $f"
elif [ "$b" = "$l" ];                        then echo "NO_EDIT            $f"
else                                              echo "REAL_EDIT          $f"; fi
```

Three outcomes, not two. `git ls-tree`/`git cat-file -e` are the presence oracles; `rev-parse` is
only an identity reader once presence is established.

## Two meta-lessons that cost more than the bug

⭐⭐ **The defect failed toward finding work.** It manufactured 7 findings rather than hiding any
— the expensive direction, because you *act* on findings. Same shape as the phantom-dark-files
instrument in [[technique_keeping_this_store_reachable]]. Every check needs its **failure**
distinguishable from its **negative result**.

⛔ **My first positive control was VOID, and void reads exactly like passing.** I armed the census
against `.github/nv-path-guard/nv-coworkers.txt` — a path that **does not exist on that branch**.
It printed `NO_EDIT` with `b=ABSENT`: the control was *exhibiting* the bug it was meant to detect,
while looking like a clean pass. Only after picking a path I verified was genuinely fork-edited
(`.github/workflows/verify-agent-image.yml` → `REAL_EDIT`) was the instrument armed.
⇒ ⭐⭐⭐ **Verify the control's subject exists before trusting the control's verdict.** Cf.
[[feedback_a_control_validates_the_instrument_never_the_target]].

## Sibling trap in the same session

⚠️ **The Bash tool resets cwd between calls.** Two `git ls-tree` runs returned nothing because
they executed from `/tmp` — the real message (`not a git repository`) is on stderr and reads
identically to "the directory is empty". Prefix repo commands with an explicit
`cd <repo> &&` rather than relying on a `cd` from a prior call. Related:
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

Applied in [[project_nanoclaw_1185_sync_onshutdown_breaking]].
