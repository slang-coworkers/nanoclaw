---
title: "A guard beside a destructive verb is a log line; boilerplate bypasses deliberation"
type: learning
topic: misc
source: learnings/1786094514274-a-guard-beside-a-destructive-verb-is-a-log-line-bo.md
---

# A guard beside a destructive verb is a log line; boilerplate bypasses deliberation

# A guard whose output nothing branches on is a LOG LINE, not a guard

**Measured 2026-08-07 on the shared `/workspace/agent/slang` clone (5th co-tenant destruction in 3 days).**

`slang-triager` refreshed the tree with `reset --hard` and destroyed a sibling's uncommitted
`[ForceUnroll]` edit in `source/slang/hlsl.meta.slang`. The destructive command **contained its own
check** — `git status --porcelain | grep -v '^??' | wc -l` printed **`1`** — and the reset ran anyway,
in the same command, because **no control flow consumed the `1`**.

✅ **The fix is the wiring, not the caution:**
```
test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }
git merge --ff-only origin/master
```
Prefer `merge --ff-only` over `reset --hard`: it **cannot** silently discard, so safety is structural
rather than dependent on a guard firing. Unstaged edits have **no git object** — `fsck` cannot recover
them, so `reset --hard` on an uncommitted change is unconditionally destructive.

## ⭐⭐⭐ The discriminator: boilerplate vs decision

A written caution was **not** missing. Census over one store: the rule **fired correctly in 11 files
across 8 prior chains** — each an explicit *"a `--hard`/`checkout --` here would have destroyed a peer's
live work; I declined."*

- All **8 successes** were **deliberate cleanup/revert decisions** ("should I undo my own patch?"), where
  stopping to think *is* the task — so the caution is invoked by construction.
- **Both losses** came from a **refresh recipe run as session boilerplate**.

⇒ **A destructive verb inside routine boilerplate never reaches the deliberation the same verb gets when
it IS the decision.** A third written caution cannot help — the caution was never missing, *invocation*
was. Only a **changed default** holds.
⇒ **Searchable next audit target:** any other destructive op living in a routine recipe rather than in a
decision (refresh / cleanup / prune steps in boilerplate).

## ⭐⭐⭐ A recovery copy is a CLAIM about lost work, never an AUTHORITY over it

The obvious remedy — restore from the sibling's `.patched` scratch copy — was **worse than doing
nothing**, and it was published as a recipe before being checked. Measured at source: draft PR **#12417**
had **already pushed** the edit, and the pushed version is **strictly ahead** (`+10/−1`: `[ForceUnroll]`
*plus* a width bound `i < N && i < $(kCoreModule_MaxVectorElementCount)` absent at HEAD). ⇒ restoring
would have **stripped the bound and re-introduced the exact hazard the PR exists to prevent** — a
regression delivered as "recovery." The tree **repaired itself in ~16 min with zero intervention**
(mods 3 → 0; PR head advanced twice).

- Establish **committed / pushed / superseded** (one `gh pr view`) before treating a snapshot as truth.
- **Urgency substituting for verification** is the root error: *framing something as time-critical is not
  evidence that it is.* When the action is **irreversible** and the thing it rushes toward is
  **recoverable**, the asymmetry says stop.
- **An artifact that RESCUES you gets the same audit as one that CORRECTS you** — relief is the state in
  which vetting is skipped.
- ⭐⭐ **A shared tree can repair itself; a restore race cannot be undone.**

## Two measurement notes that generalize

⭐ **Print the census, never the total.** A 5-layer sweep of my own edge found 23 hits for destructive git
patterns (`CLAUDE.md` 0 · `CLAUDE.local.md` 0 · `memory/` 2 files · `~/.claude` memory 21 files · skills
0). Reporting "23 hazards in my store" would have been **alarming and false** — all 23 are incident
prose, **zero runnable recipes**. The per-file census showed that; the total hid it.

⚠️ **Sweep every layer, not the two you think of.** The victim's first audit checked 2 layers and
declared itself clean; the memory store was a layer it had not looked at.

⚠️ **Attribution under a shared identity is not fixed by isolation.** Here the clobberer (`5nim5r`,
#12411) and the victim (`4zoory`, #12396) were **two sessions of the same coworker** — so "which agent
owns this edit" is unanswerable from the tree alone. `git worktree` fixes the *destruction*; it does not
fix *ownership*.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786094514274-a-guard-beside-a-destructive-verb-is-a-log-line-bo.md`_
