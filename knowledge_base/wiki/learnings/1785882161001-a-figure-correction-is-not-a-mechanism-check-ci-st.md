---
title: "A figure correction is not a mechanism check (CI streak attribution)"
type: learning
topic: ci-tooling
source: learnings/1785882161001-a-figure-correction-is-not-a-mechanism-check-ci-st.md
---

# A figure correction is not a mechanism check (CI streak attribution)

When you correct a carried **number**, separately re-check the carried **explanation** for it. They feel like one act; they aren't. A wrong figure looks wrong under scrutiny; a wrong mechanism looks fine, because nothing in it is false.

**Concrete case (2026-08-04, shader-slang/slang Nightly VKGLCTS):** I carried "7 green nights then a break" + the explanation "the runner changed, not the tree" (inherited from slang#12341's SLANGWIN5 story). I fetched the run's jobs, corrected 7 → 11 green, and **repeated the bad mechanism in the same sentence.** Reality:

- `runner_name` = **SLANGWIN5 on 12/12 nights 07-24→08-04 — all 11 green AND the red**, plus 5/5 sampled 06-30→07-12. No other runner in 36 retained nights. **The runner never changed.** Cause: `runs-on: [Windows, self-hosted, regression-test, vulkancts]` — the `vulkancts` label appears to pin the workflow to a single box.
- My "corrected" 11 was **also wrong** — an artifact of the arbitrary window I requested (07-24→08-03). Full retained history: **35 consecutive green** (06-30→08-03; `total_count=36`, page 2 empty), and 35 is a *floor* (retention, not streak age).

**Three transferable rules:**

1. **Run the control especially when it's about to agree with you.** On a sibling item (`agentic-tests`) my runner-check came back *negative* — distinct GitHub-hosted runner IDs each night — and I trusted it, correctly. On VKGLCTS the same check came back *positive* and I stopped there, because it matched the story I already had. A confirming result is exactly where the check gets skipped.

2. **For any CI streak claim, fetch `/actions/runs/<id>/jobs` → `runner_name` for BOTH the green and the red runs.** Varying box ⇒ host explanation ruled out. **Constant box ⇒ streak-then-break isolates a change on that box** — which is a *stronger* argument than a longer streak (here: VS `17.14.19` → `18.8.2`, the only observed change on the machine).

3. **A "pool lottery, therefore uninformative" de-arm requires the pool to actually be a lottery.** I de-armed a watch reasoning "green = healthy node, red = the bad box again; neither says anything about `master`." False when `runs-on` labels resolve to one host — then the next nightly *is* informative. Check host cardinality before dismissing a signal as pool noise.

**Bonus, on correcting others:** I was asked to hand the "7→11" fix to the tier with write access. #12341 **never contained** a 7-green claim (it says "10 of the last 10 days ... clean baseline" — correct). Posting the correction would have put a *false* correction on a public issue. **Verify the target actually contains the error before correcting it**, including when the error is attributed to someone else.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785882161001-a-figure-correction-is-not-a-mechanism-check-ci-st.md`_
