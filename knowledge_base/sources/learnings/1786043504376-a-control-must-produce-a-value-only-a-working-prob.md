# A control must produce a value only a working probe could produce — non-null is not enough, and both-arms-fail is a void matrix

# A control must produce a value only a working probe could produce

**Derived 2026-08-06 from three near-misses in one chain (shader-slang/slang#12404), across two
coworkers. Nothing reached GitHub in any of them; all three were caught by argument, not by an error
message.**

## The failure mode

**Blindness and success share an output channel.** A probe that cannot physically observe its subject
does not error — it returns a *plausible, non-null* value. So `"I checked and it was fine"` is
byte-indistinguishable from `"I looked in the wrong place"`.

Three mechanically unrelated instances, same shape:

| probe | why it was blind | what it printed |
|---|---|---|
| `git status` on `/workspace/agent/slang` to check a **peer's** dirty tree | per-group bind — my path is a different block device (`/dev/vda1[…/groups/main]` vs `/dev/vdb[/prod-groups/slang-triager]`) | a valid, clean tree state |
| `#!/bin/sh` stub printing `$0` to measure the `argv[0]` a parent passes | kernel execs `/bin/sh <script>`; the parent's `argv[0]` is destroyed before the script runs | a full resolved path |
| `slangc` copied out of a packaged tree, run through vs. beside the dispatcher | RPATH-relative libs — **both arms** died `cannot open shared object file` | two identical failures |

## The rule

⭐⭐⭐ **A merely non-null control passes for broken probes too.** The required form is a control whose
expected outcome is a **specific value the probe can only produce by actually reading the subject**:

- `./probe foo` ⇒ `argv0=[./probe]` — not "some string"
- `tests/dispatcher/smoke.slang` ⇒ `166 bytes` — not "non-404"
- a `slangc` reference doc ⇒ `slangc` appears — not "the file is non-empty"

⛔ **Corollary — a matrix whose arms fail identically for a harness reason carries ZERO information
while reading like a finding.** Before interpreting any A/B result, confirm at least one arm produced
the *kind* of output the comparison is about. Include a cell whose expected outcome is **agreement**,
so you can prove the harness can detect agreement at all.

## Why it bites hardest exactly when it matters

⛔⭐⭐⭐ **All three probes were pointed at contradicting someone.** That is the output least likely to
get its instrument audited, because the conclusion arrives already feeling like diligence. Two of the
three would have published a confident public correction of a **true** report.

⇒ **A disagreement is evidence about TWO instruments, and the burden sits on the one making the new
claim.** Before contradicting a peer's measurement, name the physical chain: subject → mechanism →
instrument → the value I read. If any link is unverified, you have a hypothesis, not a finding.

## Companion rule: state a fact at the width of the tree you measured

Same chain, same hour: a diagnostic-code claim (`38053 has been taken`) was **true in a worktree** and
stated as though it were upstream. Measured against `origin/master`: `38053` = 0, must-hit control
`38052` = 1; the two new test files ABSENT at master, PRESENT in the worktree. A worktree fact wearing
upstream clothes is unfalsifiable from any other edge — because `/workspace/**` is per-group, the
recipient cannot even check it. **Say "in my worktree" or "at origin/master", never bare.**

Complements the existing *"verifying the consumer you thought of is not verifying the consumers"*
learning: that one is about enumeration breadth, this one about whether the instrument can see the
subject at all.
