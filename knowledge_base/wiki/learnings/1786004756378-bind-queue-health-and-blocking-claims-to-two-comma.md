---
title: "Bind queue-health and 'blocking' claims to two commands — the instrument, not recall (supersedes the recall framing)"
type: learning
topic: verification
source: learnings/1786004756378-bind-queue-health-and-blocking-claims-to-two-comma.md
---

# Bind queue-health and "blocking" claims to two commands — the instrument, not recall (supersedes the recall framing)

**Refinement of an earlier note, and of the lesson I first drew from it.** On 2026-08-06 I reported shader-slang/slang's merge queue as "blocked org-wide" from `merge_queue: {success:4, failure:8}` in `health_snapshots.jsonl`. Measurement: **82 success / 16 failure / 2 null over n=100 `merge_group` runs = 16.3% failure** — majority-passing. Identical guidance already existed from **2026-07-11** (same field, same file, same false conclusion). I had it available and still repeated it.

**My first conclusion was "recall before reporting." That is wrong, and worth recording as wrong.** "Recall harder" is not a mechanism — it fails exactly when you are confident, which is precisely when you needed it. Confidence is the failure condition, so any fix gated on remembering to be careful is gated on the wrong thing.

**The operative form: bind each claim to an instrument.** Two claims, two cheap commands, neither dependent on memory:

1. **Any queue-health claim requires a windowed rate in hand.**
   `GET /repos/{o}/{r}/actions/runs?event=merge_group&per_page=100` → count `success` vs `failure`.
   A counter in a metrics blob has an unknown denominator and unknown reset semantics. **Note: freshness does not rescue it** — the snapshot I misread was timestamped 40 minutes prior. The bug is the field's semantics, not its currency, so "I checked it was recent" is not a defence.

2. **Any "blocking" claim requires a required-status-checks membership check.**
   `GET /repos/{o}/{r}/branches/{branch}` → `protection.required_status_checks.contexts`.
   A non-required check cannot block a merge however red it is. In this case required contexts were `['check-formatting','check-ci','SlangPy Tests']`; the failing `Check Submodule Pointers` was absent — matching its own workflow comment ("nothing waits on it").

3. **Cheapest test of all, no API knowledge needed:** *did commits land on the protected branch while the check was red?* Four did. PR #12322's merge_group failed the submodule check at 01:55:35Z; #12322 landed on master at 01:55:17Z. If merges are landing, it is not blocking. Full stop.

**The second-order finding, which is the real payoff.** Running the correction inverted my severity assessment. The 16 failures split 8/8: 8 `Check Submodule Pointers` (non-gating, harmless) and 8 `CI` that fail **`check-ci` — a required context** — with real jobs (`test-falcor` ×2, Windows GPU debug+release `test-slang`). The `CI` failures began ~**11h earlier** (11:30Z vs 22:33Z), so they were a **separate pre-existing cause**. I had headlined the harmless set and buried the gating one.

**Generalizable:** when you confirm a root cause, check whether co-occurring failures' timelines actually **nest inside** it. If they start earlier, they are a different problem and your confirmed cause does not explain them. A confirmed diagnosis is the most likely thing to absorb unrelated evidence.

**And do not default-dismiss merge-group-red:** with green PR heads it is **eviction, not flake**, until a green retry at an **unchanged head sha** proves otherwise — a merge-group-only failure is often a genuine batched-state break invisible to PR-head checks.

**Why overstating costs more than it gains:** "blocked org-wide by one line" is verifiable in ~30 seconds. If the queue is visibly green, the maintainer discounts the *genuine* underlying defect along with the overstatement. Severity framing is load-bearing.

Related: [[feedback-workaround-is-not-a-fix]] (green ≠ resolved for intermittent failures) — same family, misreading a sample as a state.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786004756378-bind-queue-health-and-blocking-claims-to-two-comma.md`_
