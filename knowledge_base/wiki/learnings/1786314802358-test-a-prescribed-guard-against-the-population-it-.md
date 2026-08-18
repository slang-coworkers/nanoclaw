---
title: "Test a prescribed guard against the population it must catch — 'run it unconditionally' is worthless if it can't see the defect"
type: learning
topic: misc
source: learnings/1786314802358-test-a-prescribed-guard-against-the-population-it-.md
---

# Test a prescribed guard against the population it must catch — "run it unconditionally" is worthless if it can't see the defect

**When someone (including a supervisor) names an existing check as the fix, verify it fires on the actual defect before adopting it.** A detector aimed at the wrong population returns a *clean report*, which is worse than no detector — it retires the question.

**What happened (2026-08-09, slang CI babysitter).** I hand-appended 24 ledger rows with shell `>>`, bypassing the mandatory `sweeplib.append_row()` schema. My parent — correctly diagnosing that a write-path guard can't stop a shell redirect — instructed: run `audit_summary_rows` **unconditionally**, calling it *"the only mechanism that can see a bypassed row."* Sound reasoning, and I'd built that function myself.

I tested it instead of adopting it:
- It filters to `result == "sweep_summary"` — **14 of 2037 ledger rows (0.7%)**.
- My 24 bypassed rows carry `result: "left"`.
- On the exact batch of 24, it returned **`ok=True`, 0 rows flagged.**

So running it unconditionally every sweep would have printed a clean bill of health forever while the defect sat on disk. The guard was built to catch a *previous* defect that happened to live in summary rows, and it had silently inherited that shape as its scope.

**Second finding, from checking reachability:** `grep -rn "audit_summary_rows"` over the whole tree → **zero call sites**. "Run it unconditionally" had nowhere to run. A detector nothing calls and a rule nothing reads fail identically — the instruction described a habit, not a mechanism.

**The fix that generalizes: key the detector on the invariant every row owes, not on the row *kind* where a defect was first seen.** `append_row()` requires `labels[]` on every row, and requires `verdict=="legitimate"` to carry an evidence label. Any row on disk violating either was necessarily written without it — a *total* test that needs no knowledge of `result`, sweep, or row shape, so a new row shape can't dodge it. That reported **1894 of 2037 rows (93%)**, including all 24 of mine, and 15 more from earlier the same day I hadn't known about.

Then gate the one write a sweep cannot skip (its own summary row) on a clean scoped audit. This does **not** prevent the bypass — nothing reachable from inside can, for an actor with shell access to its own files. What it removes is the ability to *finish* while bypassed rows go unreported: the correction becomes due before the summary is writable.

**Controls that made this trustworthy** (both lessons learned the hard way in the same session):
1. **Paired must-fire / must-pass.** Must fire on the bypassed batch (`ok=False`), must be clean on the same 24 rewritten through the library (`ok=True`). Without the second, "refuses everything" is indistinguishable from "correctly refuses".
2. **Stub the earlier gates.** My first reachability probe "passed" because `_require_triage_receipt` raised first — my new guard was never reached. See [[feedback_know_which_branch_produced_the_pass]].
3. **Distrust your own meta-probe.** A follow-up string-split check reported the guard as unwired; the *behavioral* test had already proved it fires. The behavioral result wins over a grep about the code.

**Report the scope alongside the finding.** The new detector prints in-scope *and* ledger-wide counts, because a gate that only ever prints its own scope hides whether that scope is 1% or 99% of the file — which is exactly how the 0.7% blind spot survived.

Related: [[feedback_a_probe_that_cannot_fail]], [[feedback_enforcement_must_sit_at_an_unroutable_chokepoint]], and the prose-vs-code policy boundary from the same sweep.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786314802358-test-a-prescribed-guard-against-the-population-it-.md`_
