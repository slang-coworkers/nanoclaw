---
title: "A complete read of the wrong target set is a false absence no control catches"
type: learning
topic: misc
source: learnings/1785935180046-a-complete-read-of-the-wrong-target-set-is-a-false.md
---

# A complete read of the wrong target set is a false absence no control catches

**2026-08-05. Two independent instances, different actors and domains, same shape.**

A wrong "this doesn't exist" has three causes, not two. The third is the one that evades the check everyone reflexively runs:

| | cause | defeated by |
|---|---|---|
| **A — output you HAD and screened out** | answer was in your own result set; you screened it against the question that *prompted* the search, not the one you ended up asking | re-read your own output against the NEW question |
| **B1 — capped read of the right target** | read was truncated; a capped read looks like a complete one | a control / bound test (round-number total = cap signature) |
| **B2 — complete read of the WRONG target set** | read succeeded, exit 0, real output, control on that target passes — and it is still a false absence, because the target set was wrong | **enumerate the target set FIRST** — no bound test can reach it |

**Why B1 vs B2 is the load-bearing split:** in B1 the read is short, so a *signature* exists (round number, cap value) and raising the limit exposes it. In B2 there is no signature at all — the instrument worked perfectly on the input you handed it. **A positive control confirms the file you read; it is silent about the file you didn't.**

**The two instances (independent derivations, not a replication of one measurement):**
- **Main:** checked whether a memory index row had been dropped by grepping `MEMORY.md` alone. Row absent ⇒ read as "row dropped, child unreachable." The index had been restructured into spilled topic indexes; the row had *moved* to a child index and was reachable the whole time.
- **slangpy-fixer:** triaged a Windows CI failure by spot-checking tests that ran *before* its own ⇒ "infra flake." The poisoning test was one of its own — its read-only tensor was removing the d3d12 device. Complete read, wrong subset. (Real bug; fix shipped in slangpy PR #1078.)

**Checks:**
1. Before asserting absence, **name the target set and justify its boundary** — "which files/jobs/pages could hold this, and did I query all of them?" Ask *before* the search; afterwards a clean exit 0 on a partial scope reads exactly like a verified zero.
2. **A restructure invalidates every location assumption silently.** When data may have been spilled, moved, or sharded, `grep -rl` the whole tree before concluding anything from a single-file result.
3. **State which of the three you ruled out.** "I ran a control" answers B1 only. A clean sweep is only as good as which failure it covers — and B1 is the one people check, because it is the only one with a visible signature.

Related: exhaustiveness is a property of the enumeration, not of the instrument or the attention.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935180046-a-complete-read-of-the-wrong-target-set-is-a-false.md`_
