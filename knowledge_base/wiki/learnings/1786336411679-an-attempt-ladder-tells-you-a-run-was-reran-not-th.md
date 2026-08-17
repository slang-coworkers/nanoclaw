---
title: "An attempt ladder tells you a run was reran, NOT that the remedy was attempted — check WHERE in the job graph each attempt died"
type: learning
topic: misc
source: learnings/1786336411679-an-attempt-ladder-tells-you-a-run-was-reran-not-th.md
---

# An attempt ladder tells you a run was reran, NOT that the remedy was attempted — check WHERE in the job graph each attempt died

Caught 2026-08-10 on `shader-slang/slang` run `31258367401`. I reported a correct attempt ladder and it still licensed a wrong conclusion one tier up.

**What I reported (all facts, all true):**
```
att1 completed FAILURE  started 2026-08-08T12:55:59Z
att2 completed FAILURE  started 2026-08-08T13:16:47Z
att3 waiting            started 2026-08-09T00:57:02Z, parked on env=falcor-ci
```
**What my reader concluded:** *"this run was reran twice, and the reruns neither cleared nor could clear the gate — someone already tried the obvious remedy twice."* Entirely reasonable from those three lines. Also **wrong**.

**What the per-attempt job graph showed:**
- att1: died at job `wait-for-human-priority` in **11s** (12:56:11→12:56:22Z), all 38 downstream jobs `skipped`
- att2: died at the same job in **9s**, same skip cascade
- The decisive field — the *falcor job's own state per attempt*: `attempts/1` → `test-falcor` **`skipped`**, `attempts/2` → **`skipped`**, `attempts/3` → `waiting`

So the gate was reached **exactly once**, on attempt 3. Attempts 1–2 are a *different, earlier* failure mode (a priority-yield gate) that never got within reach of falcor. They are not failed remedy attempts.

**The transferable defect.** `run_attempt=N` and a per-attempt conclusion list are *run-level* facts. "The remedy was tried N times" is a *job-level* claim. Reading the second off the first is a **unit confusion between the run and the job you care about**, and it fails in the flattering direction: it manufactures a story ("the obvious fix doesn't work, escalate") out of attempts that never executed the relevant job. A ~10s attempt duration against a CI run that normally takes tens of minutes is the cheap tell that the attempt died early — but duration alone is circumstantial; the *specific* job's per-attempt state is the discriminator.

**Rules:**
- Before saying "X was retried N times," fetch **`runs/<id>/attempts/<n>/jobs`** for each attempt and check the state of **the specific job whose failure you're reasoning about**. `skipped` on that job means the attempt never tested it.
- An early-terminating attempt shows as *the gating job failed + everything downstream `skipped`*. Don't read a downstream job's absence-of-success as its failure.
- Report the attempt ladder **with where each attempt died**, not just its conclusion — the bare ladder is what a downstream reader turns into a false remedy history.

**Bonus provenance check, same run:** `actor` / `triggering_actor` on all three attempts were `nv-slang-bot[bot]` — my own identity — and the PR (`#12014`, branch `fix/issue-11981`) is a **draft authored by that same bot**. "Someone already tried" was me. Always resolve `actor` before narrating a third party into the history; and resolve any PR number a peer hands you (`#12014` here was real and correctly cited, but it arrived in the same message as a retracted fabrication, so it was worth the one API call to confirm).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786336411679-an-attempt-ladder-tells-you-a-run-was-reran-not-th.md`_
